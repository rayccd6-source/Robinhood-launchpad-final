module onchain_invoice::invoice;

use sui::clock::{Self, Clock};
use sui::random::{Self, Random};
use std::string::String;
use sui::coin::{Self, Coin};
use sui::balance::{Self, Balance};
use onchain_invoice::tax_coin::TAX_COIN;
use onchain_invoice::treasury::{Self,Treasury};
const EExpired: u64 = 0;
const EWrongWinner: u64 = 1;

public struct Admin has key, store {
    id: UID,
}

public struct Invoice has key, store {
    id: UID,
    protocol: String,
    amount: u64,
    timestamp: u64,
    invoice_number: u64,
}

public struct System has key, store {
    id: UID,
    count: u64,
    tax_value: u64,
    balance: Balance<TAX_COIN>,
    timestamp: u64,
    winner: u64,
    counter: u64,
}

fun init(ctx: &mut TxContext) {
    let system = System {
        id: object::new(ctx),
        count: 0,
        tax_value: 100,
        balance: balance::zero(),
        timestamp: 0,
        winner: 0,
        counter: 0,
    };
    let admin = Admin {
        id: object::new(ctx),
    };
    transfer::share_object(system);
    transfer::public_transfer(admin, ctx.sender());
}

public fun lottery(_admin: &Admin, system: &mut System, random: &Random, clock: &Clock, ctx: &mut TxContext) {
    let mut generator = random::new_generator(random, ctx);
    let winner_index = generator.generate_u64_in_range(1, system.count);
    system.winner = winner_index;
    system.timestamp = clock::timestamp_ms(clock);
    system.counter = 0;
}

#[allow(lint(self_transfer))]
public fun init_invoice(tax: Coin<TAX_COIN>, system: &mut System, protocol: String, clock: &Clock, ctx: &mut TxContext) {
    let id = object::new(ctx);
    let amount = coin::value(&tax);
    let timestamp = clock::timestamp_ms(clock);
    system.count = system.count + 1;
    let invoice_number = system.count;
    let invoice = Invoice {
        id,
        protocol,
        amount,
            timestamp,
            invoice_number,
    };
    let balance = coin::into_balance(tax);
    balance::join(&mut system.balance, balance);
    transfer::public_transfer(invoice, ctx.sender());
}

public fun claim_lottery(system: &mut System, invoice: Invoice, treasury: &mut Treasury, clock: &Clock, ctx: &mut TxContext) {
    assert!(invoice.timestamp <= system.timestamp, EExpired);
    assert!(invoice.invoice_number == system.winner, EWrongWinner);
    let coin = treasury::output(treasury, ctx);
    transfer::public_transfer(coin, ctx.sender());
    let Invoice {
        id: id,
        protocol: _,
        amount: _,
        timestamp: _,
        invoice_number: _,
    } = invoice;
    object::delete(id);
}