module backend::launchpad;

use sui::coin::{Self, Coin, TreasuryCap};
use sui::balance::{Self, Balance};
use sui::table::{Self, Table};
use sui::clock::Clock;
use std::string::String;
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
    token_pool: Balance<T>,
    usdc_pool: Balance<COINUSDC>,
    priority_allocations: Table<address, u64>,
    pure_deposits: Table<address, u64>,
    claimed: Table<address, bool>,
    total_guaranteed_allocation: u64,
    total_pure_deposit: u64,
    tokens_per_pass: u64,
}

fun init(ctx: &mut TxContext) {
    transfer::public_transfer(
        AdminCap { id: object::new(ctx) },
        ctx.sender()
    );
}

public fun new<T>(//建treasury 和launchpad
    _admin: &AdminCap,
    tokens_per_pass: u64,
    base_price: u64,
    ctx: &mut TxContext,
): Launchpad<T> {
    Launchpad<T> {
        id: object::new(ctx),
        phase: PHASE_SETUP,
        base_price,
        token_pool: balance::zero<T>(),
        usdc_pool: balance::zero<COINUSDC>(),
        priority_allocations: table::new(ctx),
        pure_deposits: table::new(ctx),
        claimed: table::new(ctx),
        total_guaranteed_allocation: 0,
        total_pure_deposit: 0,
        tokens_per_pass,
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
}


public fun buy_priority_pass<T>(/// Phase 1：Priority Pass 認購（雙金庫 + 抵押鑄造橋接 + 發票系統）
    pad: &mut Launchpad<T>,
    mut payment_coin: Coin<COINUSDC>,
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
    assert!(pad.phase == PHASE_PRIORITY_BIDDING, EWrongPhase);
    let sender = ctx.sender();
    assert!(!table::contains(&pad.priority_allocations, sender), EAlreadyBoughtPass);

    let new_total_guaranteed = pad.total_guaranteed_allocation + pad.tokens_per_pass;    // 驗證代幣池是否足夠
    assert!(
        balance::value(&pad.token_pool) >= new_total_guaranteed,
        EInsufficientTokensForPass
    );

    assert!(coin::value(&payment_coin) >= pad.base_price, EInsufficientPayment);    //驗證付款金額：至少需要 base_price

    let base_coin = coin::split(&mut payment_coin, pad.base_price, ctx);
    treasuryother::givemecoinother(project_treasury, base_coin);//base price進項目方金庫

    let priority_fee_amount = coin::value(&payment_coin);    // 剩餘為 Priority Fee

    if (priority_fee_amount > 0) {        //存入平台金庫
        let platform_fee_amount = (priority_fee_amount * 20) / 100;
        let fee_coin = coin::split(&mut payment_coin, platform_fee_amount, ctx);
        mytreasury::givemecoin(platform_treasury, fee_coin);

        let amount_80 = coin::value(&payment_coin);// 剩餘 80% COINUSDC：記錄數量後存入平台金庫作為抵押準備金
        mytreasury::givemecoin(platform_treasury, payment_coin);

        let minted_usdc: Coin<USDC> = coin::mint<USDC>(usdc_treasury_cap, amount_80, ctx)//mint Coin<USDC>
        inv_treasury::input(the_invoice_treasury, minted_usdc, ctx);//將mint出的 Coin<USDC> 存入 InvoiceTreasury

        let tax_amount = amount_80 * 10;//計算 TAX_COIN 數量（1 USDC = 10 TAX_COIN）
        let tax_coin_obj = coin::mint<TAX_COIN>(tax_cap, tax_amount, ctx);      // Mint TAX_COIN 和發票
        invoice::init_invoice(tax_coin_obj, invoice_system, protocol, clock, ctx);
    } else {
        // Priority Fee 為 0，銷毀零值 Coin
        coin::destroy_zero(payment_coin);
    };

    // 6. 記錄保證分配額度與更新狀態
    table::add(&mut pad.priority_allocations, sender, pad.tokens_per_pass);
    pad.total_guaranteed_allocation = new_total_guaranteed;
}

/// Phase 2：Pure Pool 一般存款
public fun deposit_pure_pool<T>(
    pad: &mut Launchpad<T>,
    deposit_coin: Coin<COINUSDC>,
    ctx: &mut TxContext,
) {
    assert!(pad.phase == PHASE_PURE_POOL, EWrongPhase);
    let sender = ctx.sender();
    assert!(!table::contains(&pad.pure_deposits, sender), EAlreadyDeposited);

    let amount = coin::value(&deposit_coin);
    let bal = coin::into_balance(deposit_coin);
    balance::join(&mut pad.usdc_pool, bal);

    table::add(&mut pad.pure_deposits, sender, amount);
    pad.total_pure_deposit = pad.total_pure_deposit + amount;
}

/// Phase 3：結算與領取代幣（雙軌邏輯）
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

public fun has_priority_pass<T>(pad: &Launchpad<T>, user: address): bool { table::contains(&pad.priority_allocations, user) }

public fun has_pure_deposit<T>(pad: &Launchpad<T>, user: address): bool { table::contains(&pad.pure_deposits, user) }

public fun has_claimed<T>(pad: &Launchpad<T>, user: address): bool { table::contains(&pad.claimed, user) }

public fun user_guaranteed_allocation<T>(pad: &Launchpad<T>, user: address): u64 {
    if (table::contains(&pad.priority_allocations, user)) { *table::borrow(&pad.priority_allocations, user) } else { 0 }
}

public fun user_pure_deposit<T>(pad: &Launchpad<T>, user: address): u64 {
    if (table::contains(&pad.pure_deposits, user)) { *table::borrow(&pad.pure_deposits, user) } else { 0 }
}

// === Test Functions ===

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    transfer::public_transfer(
        AdminCap { id: object::new(ctx) },
        ctx.sender()
    );
}