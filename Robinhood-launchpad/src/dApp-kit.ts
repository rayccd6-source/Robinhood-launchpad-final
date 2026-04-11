// @ts-nocheck
import { createNetworkConfig } from "@mysten/dapp-kit";
import { SuiClient } from "@mysten/sui/client"; 

const { networkConfig, useNetworkVariable, useNetworkVariables } = createNetworkConfig({
  testnet: {
    url: "https://fullnode.testnet.sui.io:443",
    network: "testnet" as any,
  },
  mainnet: {
    url: "https://fullnode.mainnet.sui.io:443",
    network: "mainnet" as any,
  },
});

export { networkConfig, useNetworkVariable, useNetworkVariables };

export const dappConfig = {
  networkConfig,
  createClient(network: "mainnet" | "testnet") {
    const url = network === "mainnet" 
      ? "https://fullnode.mainnet.sui.io:443" 
      : "https://fullnode.testnet.sui.io:443";
      
    // 使用傳統建構方式
    return new (SuiClient as any)({ url });
  },
};