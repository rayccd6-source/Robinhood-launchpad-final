module backend::treasuryother;

use sui::balance::{Self, Balance};
use sui::coin::{Self, Coin};

public struct Treasury<phantom T> has key {
    id: UID,
    pool: Balance<T>,
}
public struct AdminCap has key, store {
    id: UID,
}

public fun createother<T>(ctx: &mut TxContext) {
    let treasury = Treasury<T> {
        id: object::new(ctx),
        pool: balance::zero<T>(),
    };
    transfer::share_object(treasury);
}

fun init(ctx: &mut TxContext) {
    transfer::public_transfer(AdminCap { id: object::new(ctx) }, ctx.sender());
}

public fun givemecoinother<T>(treasury: &mut Treasury<T>, coin: Coin<T>) {
    let balance = coin::into_balance(coin);
    balance::join(&mut treasury.pool, balance);
}

public fun withdrawother<T>(_admin: &AdminCap, treasury: &mut Treasury<T>, amount: u64, ctx: &mut TxContext): Coin<T> {
    coin::take(&mut treasury.pool, amount, ctx)
}
