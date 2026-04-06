module backend ::coinsuix;

use sui::coin_registry;
use sui::coin::{Self, TreasuryCap};
use sui::transfer;
use sui::tx_context::{Self, TxContext};

public struct COINSUIX has drop {}

fun init(witness: COINSUIX, ctx: &mut TxContext) {
    let (builder, treasury_cap) = coin_registry::new_currency_with_otw(
        witness,
        6,
        b"suix".to_string(),
        b"suix".to_string(),
        b"fake coin for lauchpad".to_string(),
        b"https://s2.coinmarketcap.com/static/img/coins/64x64/23490.png".to_string(),
        ctx
    );

    let metadata_cap = builder.finalize(ctx);
    transfer::public_transfer(metadata_cap, ctx.sender());
    transfer::public_share_object(treasury_cap);
}

public fun request_faucet_suix(
    treasury_cap: &mut TreasuryCap<COINSUIX>,
    amount: u64, 
    ctx: &mut TxContext,
) {
    coin::mint_and_transfer(
        treasury_cap,
        amount,
        tx_context::sender(ctx),
        ctx,
    );
}