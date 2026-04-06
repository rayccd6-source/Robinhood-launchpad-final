module onchain_invoice::treasury;

use sui::balance::{Self, Balance};
use sui::coin::{Self, Coin};

use onchain_invoice::usdc::USDC;

public struct Treasury has key {
    id: UID,
    pool: Balance<USDC>,
}

fun init(ctx: &mut TxContext) {
    let treasury = Treasury {
        id: object::new(ctx),
        pool: balance::zero()
    };
    transfer::share_object(treasury);
}

public fun input(treasury: &mut Treasury, coin: Coin<USDC>, _ctx: &mut TxContext) {
    let balance = coin::into_balance(coin);
    balance::join(&mut treasury.pool, balance);
}

public(package) fun output(treasury: &mut Treasury, ctx: &mut TxContext): Coin<USDC> {
    let amount = treasury.pool.value();
    coin::from_balance(balance::split(&mut treasury.pool, amount), ctx)
}