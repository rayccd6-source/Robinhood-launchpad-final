import { Transaction } from "@mysten/sui/transactions";

export const BACKEND_PACKAGE_ID = "0x8cae9de2c7a9d48d52bbc391486fc5d3fab420d5b34e1ee956e1dc85a10800f2";
export const USDC_PACKAGE_ID = BACKEND_PACKAGE_ID;
export const USDC_COIN_TYPE = `${USDC_PACKAGE_ID}::coinusdc::COINUSDC`;

export const PROJECT_TREASURY_SHARED_ID = "0x1d4d07ca5e7873ef2506e0f2344d44047be1d1a826071f168e73ac7e500db2b8";
export const PROJECT_TREASURYother_SHARED_ID = "0xe13e48c3f7d4bb57a324e56271b385fcf1a66799ed0d8a293408f8e20be6c0b2";
export const LAUNCHPAD_SHARED_ID = "0x324050b6f1ff0f42f3577436725156fcb3d13d9a44f4488b5bb244dc8347e289";
export const ADMIN_CAP_ID = "0xafbbde207cd727ef4a372887097ef47f0f4b5dadaa78a1ae32147c2a75c3cf14"; 

const treasurySharedId = "0x5e91a6f1b2878ed1e63d0bf0656ff8a216129a2bcfff9f55896d1fd5fbcbedb5"; 
export const TREASURY_PACKAGE_ID = BACKEND_PACKAGE_ID;
export const TREASURYother_PACKAGE_ID = BACKEND_PACKAGE_ID;
export const LAUNCHPAD_PACKAGE_ID = BACKEND_PACKAGE_ID;
export const TARGET_COIN_TYPE = `${LAUNCHPAD_PACKAGE_ID}::coinsuix::COINSUIX`;

export const INVOICE_USDC_TREASURY_CAP = "0x1e9e54b2490958184e2326f409d84764539fa02416cb5efe1850c0209a8b1a9f";
export const INVOICE_TREASURY_ID = "0x1014cf1b44e64fb63439c2d0d159015a0780289afa5a5f93f3297a000eb2f049";
export const INVOICE_ADMIN_CAP_ID = "0x2754fe63d1295da2e9ce3bff138edaeb3eb8327eb7b0132a5adbe5f693efca5a";
export const INVOICE_SYSTEM_ID = "0x2c0aab09b8b3d9e341776717e75636b7f9ed23a326718d898d0c68fe35ccdbd1";
export const TAX_COIN_TREASURY_CAP = "0x461d8c76bae634e0a01d1afb30b5d13da9ccc59ea3b211142f6b5cc42378930f";
export const INVOICE_PACKAGE_ID = "0x5b3cb78005cf992cec170ae62784a467dc2e7b03a4f2f4f88c91d7feb4916fd7";

export const deposit_to_project_treasury = (tx: Transaction, coinToDeposit: any, coinType: string = USDC_COIN_TYPE, treasuryId: string = PROJECT_TREASURY_SHARED_ID) => {
  tx.moveCall({
    target: `${TREASURY_PACKAGE_ID}::mytreasury::givemecoin`, 
    typeArguments: [coinType],                             
    arguments: [tx.object(treasuryId), coinToDeposit],
  });
};

export const withdraw_from_project_treasury = (tx: Transaction, adminCapId: string, amount: number, recipientAddress: string, coinType: string = USDC_COIN_TYPE, treasuryId: string = PROJECT_TREASURY_SHARED_ID) => {
  const [withdrawnCoin] = tx.moveCall({
    target: `${TREASURY_PACKAGE_ID}::mytreasury::withdraw`,
    typeArguments: [coinType],
    arguments: [tx.object(adminCapId), tx.object(treasuryId), tx.pure.u64(amount)],
  });
  tx.transferObjects([withdrawnCoin], recipientAddress);
};

export const deposit_to_project_treasuryother = (tx: Transaction, coinToDeposit: any, coinType: string = USDC_COIN_TYPE, treasuryId: string = PROJECT_TREASURYother_SHARED_ID) => {
  tx.moveCall({
    target: `${TREASURYother_PACKAGE_ID}::treasuryother::givemecoinother`, 
    typeArguments: [coinType],                             
    arguments: [tx.object(treasuryId), coinToDeposit],
  });
};

export const withdraw_from_project_treasuryother = (tx: Transaction, adminCapId: string, amount: number, recipientAddress: string, coinType: string = USDC_COIN_TYPE, treasuryId: string = PROJECT_TREASURYother_SHARED_ID) => {
  const [withdrawnCoin] = tx.moveCall({
    target: `${TREASURYother_PACKAGE_ID}::treasuryother::withdrawother`,
    typeArguments: [coinType],
    arguments: [tx.object(adminCapId), tx.object(treasuryId), tx.pure.u64(amount)],
  });
  tx.transferObjects([withdrawnCoin], recipientAddress);
};

// ==============================================
// 🚰 Faucet 操作
// ==============================================
export async function request_faucet(tx: Transaction) {
    tx.moveCall({
        target: `${USDC_PACKAGE_ID}::coinusdc::request_faucet`,
        arguments: [tx.object(treasurySharedId)],
    });
}

export async function request_faucet_suix(tx: Transaction, amount: number) {
    tx.moveCall({
        target: `${LAUNCHPAD_PACKAGE_ID}::coinsuix::request_faucet_suix`,
        arguments: [
            tx.object("0xfd2e4cbc2e96fcb015b95f68b921534965a8e5c6264d5163dbe22c64c5c09ef4"), 
            tx.pure.u64(amount),
        ],
    });
}

export const force_next_phase = (tx: Transaction) => {
  tx.moveCall({
    target: `${LAUNCHPAD_PACKAGE_ID}::launchpad::force_next_phase`,
    typeArguments: [TARGET_COIN_TYPE],
    arguments: [tx.object(LAUNCHPAD_SHARED_ID), tx.object(ADMIN_CAP_ID)],
  });
};

// 玩家出價 
export const place_bid = (
  tx: Transaction,
  bidCoin: any
) => {
  tx.moveCall({
    target: `${LAUNCHPAD_PACKAGE_ID}::launchpad::place_bid`,
    typeArguments: [TARGET_COIN_TYPE],
    arguments: [
      tx.object(LAUNCHPAD_SHARED_ID),
      bidCoin
    ],
  });
};

// 結算拍賣名單
export const settle_auction_by_winners = (
  tx: Transaction,
  winners: string[], // 傳入一個包含所有得標者錢包地址的陣列
  protocolName: string = "Robinhood.Pad"
) => {
  tx.moveCall({
    target: `${LAUNCHPAD_PACKAGE_ID}::launchpad::settle_auction_by_winners`,
    typeArguments: [TARGET_COIN_TYPE],
    arguments: [
      tx.object(LAUNCHPAD_SHARED_ID),
      tx.object(ADMIN_CAP_ID),
      tx.pure.vector('address', winners),         // 轉換成 Move 的 vector<address>
      tx.object(INVOICE_USDC_TREASURY_CAP),       
      tx.object(PROJECT_TREASURYother_SHARED_ID), 
      tx.object(PROJECT_TREASURY_SHARED_ID),      
      tx.object(INVOICE_TREASURY_ID),             
      tx.object(INVOICE_SYSTEM_ID),               
      tx.object(TAX_COIN_TREASURY_CAP),           
      tx.pure.string(protocolName),               
      tx.object("0x6"), // clock                           
    ],
  });
};

// 更質押池單人上限
export const update_max_deposit = (tx: Transaction, newMaxUsdc: number) => {
  const amountMists = Math.floor(newMaxUsdc * 1_000_000);
  tx.moveCall({
    target: `${LAUNCHPAD_PACKAGE_ID}::launchpad::update_max_deposit`,
    typeArguments: [TARGET_COIN_TYPE],
    arguments: [
      tx.object(LAUNCHPAD_SHARED_ID),
      tx.object(ADMIN_CAP_ID),
      tx.pure.u64(amountMists)
    ],
  });
};

//錢存入質押池
export const deposit_pure_pool = (tx: Transaction, userUsdcCoinId: string, amount: number) => {
  const amountMists = Math.floor(amount * 1_000_000);
  const [depositCoin] = tx.splitCoins(tx.object(userUsdcCoinId), [tx.pure.u64(amountMists)]);

  tx.moveCall({
    target: `${LAUNCHPAD_PACKAGE_ID}::launchpad::deposit_pure_pool`,
    typeArguments: [TARGET_COIN_TYPE],
    arguments: [
      tx.object(LAUNCHPAD_SHARED_ID),
      depositCoin,
    ],
  });
};

// 領取 Token
export const claim_project_tokens = (tx: Transaction, userAddress: string) => {
  const [tokens] = tx.moveCall({
    target: `${LAUNCHPAD_PACKAGE_ID}::launchpad::claim_tokens`,
    typeArguments: [TARGET_COIN_TYPE],
    arguments: [
      tx.object(LAUNCHPAD_SHARED_ID),
    ],
  });
  tx.transferObjects([tokens], userAddress);
};

// 未得標者退款 USDC
export const claim_refund = (tx: Transaction, userAddress: string) => {
  const [refundCoin] = tx.moveCall({
    target: `${LAUNCHPAD_PACKAGE_ID}::launchpad::claim_refund`,
    typeArguments: [TARGET_COIN_TYPE],
    arguments: [
      tx.object(LAUNCHPAD_SHARED_ID),
    ],
  });
  tx.transferObjects([refundCoin], userAddress);
};

//領出所有募資到的 USDC
export const withdraw_raised_funds = (tx: Transaction, recipientAddress: string) => {
  const [withdrawnCoin] = tx.moveCall({
    target: `${LAUNCHPAD_PACKAGE_ID}::launchpad::withdraw_usdc`,
    typeArguments: [TARGET_COIN_TYPE],
    arguments: [
      tx.object(LAUNCHPAD_SHARED_ID),
      tx.object(ADMIN_CAP_ID),
    ],
  });
  tx.transferObjects([withdrawnCoin], recipientAddress);
};

export const lottery_draw = (tx: Transaction) => {
  tx.moveCall({
    target: `${INVOICE_PACKAGE_ID}::invoice::lottery`,
    arguments: [
      tx.object(INVOICE_ADMIN_CAP_ID),  
      tx.object(INVOICE_SYSTEM_ID),     
      tx.object("0x8"),                 
      tx.object("0x6"),                 
    ],
  });
};

export const claim_lottery_prize = (tx: Transaction, invoiceObjectId: string) => {
  tx.moveCall({
    target: `${INVOICE_PACKAGE_ID}::invoice::claim_lottery`,
    arguments: [
      tx.object(INVOICE_SYSTEM_ID),     
      tx.object(invoiceObjectId),       
      tx.object(INVOICE_TREASURY_ID),   
      tx.object("0x6"),                 
    ],
  });
};