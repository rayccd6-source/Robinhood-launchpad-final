module backend::coinusdc;

use sui::coin_registry;
use sui::coin::{Self, TreasuryCap};
use sui::transfer;
use sui::tx_context::{Self, TxContext};

public struct COINUSDC has drop {}

fun init(witness: COINUSDC, ctx: &mut TxContext) {
    let (builder, treasury_cap) = coin_registry::new_currency_with_otw(
        witness,
        6,
        b"fUSDC".to_string(),
        b"fUSDC".to_string(),
        b"fake coin for lauchpad".to_string(),
        b"https://s2.coinmarketcap.com/static/img/coins/64x64/23490.png".to_string(),
        ctx
    );

    let metadata_cap = builder.finalize(ctx);
    transfer::public_transfer(metadata_cap, ctx.sender());
    transfer::public_share_object(treasury_cap);
}

public fun request_faucet(
    treasury_cap: &mut TreasuryCap<COINUSDC>,
    ctx: &mut TxContext,
) {
    let mint_amount = 1000 * 1_000_000; // 每次給 1,000 顆 fUSDC（6位小數）
    coin::mint_and_transfer(
        treasury_cap,
        mint_amount,
        tx_context::sender(ctx),
        ctx,
    );
}