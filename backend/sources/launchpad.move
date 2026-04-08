module backend::launchpad;

use sui::coin::{Self, Coin, TreasuryCap};
use sui::balance::{Self, Balance};
use sui::table::{Self, Table};
use sui::clock::Clock;
use std::string::String;
use std::vector;
use backend::coinusdc::COINUSDC;
use backend::mytreasury::{Self, Treasury as PlatformTreasury};
use backend::treasuryother::{Self, Treasury as ProjectTreasury};
use onchain_invoice::usdc::USDC;
use onchain_invoice::invoice::{Self, System};
use onchain_invoice::tax_coin::TAX_COIN;
use onchain_invoice::treasury::{Self as inv_treasury, Treasury as InvoiceTreasury};

const EWrongPhase: u64 = 0;
const EAlreadyBoughtPass: u64 = 1;
const EAlreadyDeposited: u64 = 2;
const EAlreadyClaimed: u64 = 3;
const ENothingToClaim: u64 = 4;
const ENoTokensInPool: u64 = 5;
const EInsufficientTokensForPass: u64 = 6;
const EPurePoolEmpty: u64 = 7;
const EInsufficientPayment: u64 = 8;
const ENoRefund: u64 = 9;
const EOverMaxDeposit: u64 = 10;

const PHASE_SETUP: u8 = 0;
const PHASE_PRIORITY_BIDDING: u8 = 1;
const PHASE_PURE_POOL: u8 = 2;
const PHASE_SETTLEMENT: u8 = 3;

public struct AdminCap has key, store {
    id: UID,
}

public struct Launchpad<phantom T> has key {
    id: UID,
    phase: u8,
    base_price: u64,

    // 發售代幣池
    token_pool: Balance<T>,

    // Phase 2 普惠質押 USDC 池
    usdc_pool: Balance<COINUSDC>,

    // Phase 1 拍賣：每個地址的總出價（USDC 數量）
    bids: Table<address, u64>,
    // Phase 1 拍賣：所有出價對應的 USDC 暫存池
    bids_usdc_pool: Balance<COINUSDC>,

    // Phase 2 結算後：得標者的保證配額
    priority_allocations: Table<address, u64>,

    // Phase 2：普惠質押存款
    pure_deposits: Table<address, u64>,

    // 是否已領取代幣
    claimed: Table<address, bool>,

    // Phase 1 + Phase 2 的統計
    total_guaranteed_allocation: u64,
    total_pure_deposit: u64,
    tokens_per_pass: u64,

    // Phase 2：每錢包最大存款上限
    max_deposit_per_wallet: u64,

    // Phase 3：Phase1 未得標者是否已退款
    refunded: Table<address, bool>,
}

fun init(ctx: &mut TxContext) {
    transfer::public_transfer(
        AdminCap { id: object::new(ctx) },
        ctx.sender()
    );
}

public fun new<T>(
    _admin: &AdminCap,
    tokens_per_pass: u64,
    base_price: u64,
    max_deposit_per_wallet: u64,
    ctx: &mut TxContext,
): Launchpad<T> {
    Launchpad<T> {
        id: object::new(ctx),
        phase: PHASE_SETUP,
        base_price,
        token_pool: balance::zero<T>(),
        usdc_pool: balance::zero<COINUSDC>(),
        bids: table::new(ctx),
        bids_usdc_pool: balance::zero<COINUSDC>(),
        priority_allocations: table::new(ctx),
        pure_deposits: table::new(ctx),
        claimed: table::new(ctx),
        total_guaranteed_allocation: 0,
        total_pure_deposit: 0,
        tokens_per_pass,
        max_deposit_per_wallet,
        refunded: table::new(ctx),
    }
}

public fun share<T>(pad: Launchpad<T>) {
    transfer::share_object(pad);
}

public fun deposit_tokens<T>(
    pad: &mut Launchpad<T>,
    _admin: &AdminCap,
    tokens: Coin<T>,
) {
    assert!(pad.phase == PHASE_SETUP, EWrongPhase);
    let bal = coin::into_balance(tokens);
    balance::join(&mut pad.token_pool, bal);
}

public fun force_next_phase<T>(
    pad: &mut Launchpad<T>,
    _admin: &AdminCap,
) {
    pad.phase = pad.phase + 1;
    if (pad.phase > PHASE_SETTLEMENT) {
        pad.phase = 0;
    }
}

// =======================
// Phase 1: 拍賣競標期
// =======================

/// Phase 1：使用者出價（USDC 進 bids_usdc_pool，金額記錄在 bids）
/// 不分配金庫、不鑄發票。
public fun place_bid<T>(
    pad: &mut Launchpad<T>,
    bid_coin: Coin<COINUSDC>,
    ctx: &mut TxContext,
) {
    assert!(pad.phase == PHASE_PRIORITY_BIDDING, EWrongPhase);
    let sender = ctx.sender();
    let amount = coin::value(&bid_coin);
    assert!(amount >= pad.base_price, EInsufficientPayment);

    // USDC 進拍賣暫存池
    let bal = coin::into_balance(bid_coin);
    balance::join(&mut pad.bids_usdc_pool, bal);

    // 累加該地址的總出價
    let current = if (table::contains(&pad.bids, sender)) {
        *table::borrow(&pad.bids, sender)
    } else {
        0
    };
    let new_total = current + amount;

    if (table::contains(&pad.bids, sender)) {
        let _old = table::remove(&mut pad.bids, sender);
        // _old: u64 丟棄
    };
    table::add(&mut pad.bids, sender, new_total);
}

// =======================
// Phase 2: 拍賣結算 + 普惠質押
// =======================

public fun update_max_deposit<T>(
    pad: &mut Launchpad<T>,
    _admin: &AdminCap,
    new_max: u64,
) {
    pad.max_deposit_per_wallet = new_max;
}

/// 內部工具：對單一得標者執行原本 buy_priority_pass 的金流 + 發票邏輯，
/// 並在 priority_allocations 中記錄 tokens_per_pass。
fun settle_single_winner<T>(
    pad: &mut Launchpad<T>,
    winner: address,
    usdc_treasury_cap: &mut TreasuryCap<USDC>,
    project_treasury: &mut ProjectTreasury<COINUSDC>,
    platform_treasury: &mut PlatformTreasury<COINUSDC>,
    the_invoice_treasury: &mut InvoiceTreasury,
    invoice_system: &mut System,
    tax_cap: &mut TreasuryCap<TAX_COIN>,
    protocol: &String,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    if (!table::contains(&pad.bids, winner)) {
        // 沒有出價就略過
        return
    };

    let bid_amount = *table::borrow(&pad.bids, winner);

    // 從 bids_usdc_pool 中取出對應金額
    let mut payment_coin = coin::take(&mut pad.bids_usdc_pool, bid_amount, ctx);

    // 驗證代幣池是否足夠新增一份保證配額
    let new_total_guaranteed = pad.total_guaranteed_allocation + pad.tokens_per_pass;
    assert!(
        balance::value(&pad.token_pool) >= new_total_guaranteed,
        EInsufficientTokensForPass
    );

    // 至少要有 base_price
    assert!(coin::value(&payment_coin) >= pad.base_price, EInsufficientPayment);

    // === 以下邏輯完全沿用原本 buy_priority_pass ===

    // base_price 進項目方金庫
    let base_coin = coin::split(&mut payment_coin, pad.base_price, ctx);
    treasuryother::givemecoinother(project_treasury, base_coin);

    // 剩餘為 Priority Fee
    let priority_fee_amount = coin::value(&payment_coin);

    if (priority_fee_amount > 0) {
        // 20% 進平台金庫
        let platform_fee_amount = (priority_fee_amount * 20) / 100;
        let fee_coin = coin::split(&mut payment_coin, platform_fee_amount, ctx);
        mytreasury::givemecoin(platform_treasury, fee_coin);

        // 剩餘 80% 進平台金庫，並用於鑄造 USDC / TAX_COIN + 發票
        let amount_80 = coin::value(&payment_coin);
        mytreasury::givemecoin(platform_treasury, payment_coin);

        let minted_usdc: Coin<USDC> = coin::mint<USDC>(usdc_treasury_cap, amount_80, ctx);
        inv_treasury::input(the_invoice_treasury, minted_usdc, ctx);

        let tax_amount = amount_80 * 10;
        let tax_coin_obj = coin::mint<TAX_COIN>(tax_cap, tax_amount, ctx);
        invoice::init_invoice(tax_coin_obj, invoice_system, *protocol, clock, ctx);
    } else {
        coin::destroy_zero(payment_coin);
    };

    // 記錄保證配額
    if (table::contains(&pad.priority_allocations, winner)) {
        let _old = table::remove(&mut pad.priority_allocations, winner);
        // _old: u64 丟棄
    };
    table::add(&mut pad.priority_allocations, winner, pad.tokens_per_pass);
    pad.total_guaranteed_allocation = new_total_guaranteed;

    // 該地址的 bid 已被完全結算，從 bids 中移除
    let _removed = table::remove(&mut pad.bids, winner);
    // _removed: u64 丟棄
}

/// Phase 2 Admin：結算拍賣（傳入得標者列表），
/// 對 winners 執行 settle_single_winner，
/// 未在 winners 中但有 bids 的地址，其出價保留在 bids + bids_usdc_pool，供 Phase 3 退款。
public fun settle_auction_by_winners<T>(
    pad: &mut Launchpad<T>,
    _admin: &AdminCap,
    winners: vector<address>,
    usdc_treasury_cap: &mut TreasuryCap<USDC>,
    project_treasury: &mut ProjectTreasury<COINUSDC>,
    platform_treasury: &mut PlatformTreasury<COINUSDC>,
    the_invoice_treasury: &mut InvoiceTreasury,
    invoice_system: &mut System,
    tax_cap: &mut TreasuryCap<TAX_COIN>,
    protocol: String,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(pad.phase == PHASE_PURE_POOL, EWrongPhase);

    let len = vector::length(&winners);
    let mut i = 0;
    while (i < len) {
        let winner = *vector::borrow(&winners, i);
        settle_single_winner(
            pad,
            winner,
            usdc_treasury_cap,
            project_treasury,
            platform_treasury,
            the_invoice_treasury,
            invoice_system,
            tax_cap,
            &protocol,
            clock,
            ctx,
        );
        i = i + 1;
    };
}

/// Phase 2：Pure Pool 一般存款（含每錢包上限檢查）
/// 注意：Phase 2 同時允許 Admin 結算拍賣與使用者進行普惠質押。
public fun deposit_pure_pool<T>(
    pad: &mut Launchpad<T>,
    deposit_coin: Coin<COINUSDC>,
    ctx: &mut TxContext,
) {
    assert!(pad.phase == PHASE_PURE_POOL, EWrongPhase);
    let sender = ctx.sender();

    let amount = coin::value(&deposit_coin);

    // 累積存款 = 已有存款 + 本次
    let current = if (table::contains(&pad.pure_deposits, sender)) {
        *table::borrow(&pad.pure_deposits, sender)
    } else {
        0
    };
    let new_total = current + amount;
    assert!(new_total <= pad.max_deposit_per_wallet, EOverMaxDeposit);

    // USDC 進普惠池
    let bal = coin::into_balance(deposit_coin);
    balance::join(&mut pad.usdc_pool, bal);

    // 更新 pure_deposits
    if (table::contains(&pad.pure_deposits, sender)) {
        let _old = table::remove(&mut pad.pure_deposits, sender);
        // _old: u64 丟棄
    };
    table::add(&mut pad.pure_deposits, sender, new_total);

    pad.total_pure_deposit = pad.total_pure_deposit + amount;
}

// =======================
// Phase 3: 領取與退款
// =======================

/// Phase 3：結算與領取代幣（雙軌邏輯）
/// - 若有 priority_allocations：領保證配額
/// - 否則若有 pure_deposits：依比例分配剩餘代幣
public fun claim_tokens<T>(
    pad: &mut Launchpad<T>,
    ctx: &mut TxContext,
): Coin<T> {
    assert!(pad.phase == PHASE_SETTLEMENT, EWrongPhase);
    let sender = ctx.sender();

    assert!(!table::contains(&pad.claimed, sender), EAlreadyClaimed);

    let user_tokens: u64;

    if (table::contains(&pad.priority_allocations, sender)) {
        user_tokens = *table::borrow(&pad.priority_allocations, sender);
        assert!(balance::value(&pad.token_pool) >= user_tokens, ENoTokensInPool);
    } else if (table::contains(&pad.pure_deposits, sender)) {
        let total_tokens = balance::value(&pad.token_pool);
        assert!(total_tokens > pad.total_guaranteed_allocation, ENoTokensInPool);
        let pure_pool_tokens = total_tokens - pad.total_guaranteed_allocation;

        assert!(pad.total_pure_deposit > 0, EPurePoolEmpty);
        let user_deposit = *table::borrow(&pad.pure_deposits, sender);

        user_tokens = (user_deposit * pure_pool_tokens) / pad.total_pure_deposit;
    } else {
        abort ENothingToClaim
    };

    assert!(user_tokens > 0, ENothingToClaim);
    assert!(balance::value(&pad.token_pool) >= user_tokens, ENoTokensInPool);

    table::add(&mut pad.claimed, sender, true);

    coin::take(&mut pad.token_pool, user_tokens, ctx)
}

/// Phase 3：拍賣未得標者退款（Pull pattern）
/// 條件：
/// - sender 在 bids 中仍有金額（代表未被 settle_single_winner 處理）
/// - 尚未在 refunded 中標記
public fun claim_refund<T>(
    pad: &mut Launchpad<T>,
    ctx: &mut TxContext,
): Coin<COINUSDC> {
    assert!(pad.phase == PHASE_SETTLEMENT, EWrongPhase);
    let sender = ctx.sender();

    if (table::contains(&pad.refunded, sender)) {
        abort ENoRefund
    };

    if (!table::contains(&pad.bids, sender)) {
        abort ENoRefund
    };

    let amount = *table::borrow(&pad.bids, sender);
    assert!(amount > 0, ENoRefund);

    // 從 bids_usdc_pool 中取出對應金額
    let refund_coin = coin::take(&mut pad.bids_usdc_pool, amount, ctx);

    // 標記已退款並移除 bid 記錄
    table::add(&mut pad.refunded, sender, true);
    let _removed = table::remove(&mut pad.bids, sender);
    // _removed: u64 丟棄

    refund_coin
}

// === Admin Functions ===

public fun withdraw_usdc<T>(
    pad: &mut Launchpad<T>,
    _admin: &AdminCap,
    ctx: &mut TxContext,
): Coin<COINUSDC> {
    assert!(pad.phase == PHASE_SETTLEMENT, EWrongPhase);
    let amount = balance::value(&pad.usdc_pool);
    coin::take(&mut pad.usdc_pool, amount, ctx)
}

// === View Functions ===

public fun phase<T>(pad: &Launchpad<T>): u8 { pad.phase }

public fun base_price<T>(pad: &Launchpad<T>): u64 { pad.base_price }

public fun total_tokens_remaining<T>(pad: &Launchpad<T>): u64 { balance::value(&pad.token_pool) }

public fun total_usdc_collected<T>(pad: &Launchpad<T>): u64 { balance::value(&pad.usdc_pool) }

public fun total_guaranteed_allocation<T>(pad: &Launchpad<T>): u64 { pad.total_guaranteed_allocation }

public fun total_pure_deposit<T>(pad: &Launchpad<T>): u64 { pad.total_pure_deposit }

public fun tokens_per_pass<T>(pad: &Launchpad<T>): u64 { pad.tokens_per_pass }

public fun max_deposit_per_wallet<T>(pad: &Launchpad<T>): u64 { pad.max_deposit_per_wallet }

public fun has_priority_pass<T>(pad: &Launchpad<T>, user: address): bool {
    table::contains(&pad.priority_allocations, user)
}

public fun has_pure_deposit<T>(pad: &Launchpad<T>, user: address): bool {
    table::contains(&pad.pure_deposits, user)
}

public fun has_claimed<T>(pad: &Launchpad<T>, user: address): bool {
    table::contains(&pad.claimed, user)
}

public fun has_refunded<T>(pad: &Launchpad<T>, user: address): bool {
    table::contains(&pad.refunded, user)
}

public fun user_guaranteed_allocation<T>(pad: &Launchpad<T>, user: address): u64 {
    if (table::contains(&pad.priority_allocations, user)) {
        *table::borrow(&pad.priority_allocations, user)
    } else {
        0
    }
}

public fun user_pure_deposit<T>(pad: &Launchpad<T>, user: address): u64 {
    if (table::contains(&pad.pure_deposits, user)) {
        *table::borrow(&pad.pure_deposits, user)
    } else {
        0
    }
}

public fun user_bid<T>(pad: &Launchpad<T>, user: address): u64 {
    if (table::contains(&pad.bids, user)) {
        *table::borrow(&pad.bids, user)
    } else {
        0
    }
}

// === Test Functions ===

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    transfer::public_transfer(
        AdminCap { id: object::new(ctx) },
        ctx.sender()
    );
}