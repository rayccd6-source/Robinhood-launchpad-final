import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

// 引入 Tailwind 與 Sui 官方的預設樣式
import './index.css';
import '@mysten/dapp-kit/dist/index.css';

// 引入 Web3 必備的保護罩 (Providers)
import { createNetworkConfig, SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// 建立查詢客戶端 (負責管理非同步資料)
const queryClient = new QueryClient();

// 設定 Sui 區塊鏈的網路 (這裡預設用 testnet 測試網)
const { networkConfig} = createNetworkConfig({
	testnet: { 
		url: 'https://fullnode.testnet.sui.io:443',
		network: 'testnet' as any // 加上這一行
	},
	mainnet: { 
		url: 'https://fullnode.mainnet.sui.io:443',
		network: 'mainnet' as any // 加上這一行
	},
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
        <WalletProvider autoConnect={true}>
          <App />
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);