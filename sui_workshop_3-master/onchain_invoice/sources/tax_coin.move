module onchain_invoice::tax_coin;

use sui::coin_registry;
use sui::coin::{Self, Coin, TreasuryCap};
use onchain_invoice::treasury::{Self, Treasury};
use onchain_invoice::usdc::USDC;

public struct TAX_COIN has drop {}

fun init(witness: TAX_COIN, ctx: &mut TxContext) {
    let (builder, treasury_cap) = coin_registry::new_currency_with_otw(
        witness,
        6,
        b"TAX".to_string(),
        b"TAX_COIN".to_string(),
        b"fake tax coin for protocol".to_string(),
        b"https://cdn-icons-png.flaticon.com/512/8744/8744976.png".to_string(),
        ctx
    );

    let metadata_cap = builder.finalize(ctx);
    transfer::public_transfer(metadata_cap, ctx.sender());
    transfer::public_share_object(treasury_cap);
}

public fun buy_quota(
    in_coin: Coin<USDC>,
    treasury_cap: &mut TreasuryCap<TAX_COIN>,
    treasury: &mut Treasury,
    ctx: &mut TxContext
) {
    let in_coin_value = coin::value(&in_coin);
    let out_coin_amount = in_coin_value * 10;
    let out_coin = coin::mint<TAX_COIN>(treasury_cap, out_coin_amount, ctx);
    treasury::input(treasury, in_coin, ctx);
    transfer::public_transfer(out_coin, ctx.sender())
}