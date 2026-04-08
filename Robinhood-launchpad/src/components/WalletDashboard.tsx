import { useState, useEffect } from 'react';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';

export default function WalletDashboard() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const [balances, setBalances] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchBalances = async () => {
      if (!account) return;
      setIsLoading(true);
      try {
        const res = await suiClient.getAllBalances({ owner: account.address });
        setBalances(res);
      } catch (error) {
        console.error("Failed to fetch balances", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchBalances();
  }, [account, suiClient]);

  const formatBalance = (coinType: string, balance: string) => {
    if (coinType === '0x2::sui::SUI') return (Number(balance) / 1e9).toFixed(4);
    return (Number(balance) / 1e6).toFixed(4);
  };

  const getSymbol = (coinType: string) => {
    if (coinType === '0x2::sui::SUI') return 'SUI';
    return coinType.split('::').pop() || 'UNKNOWN';
  };

  if (!account) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4 animate-fade-in">
        <div className="w-20 h-20 bg-gray-900 rounded-full flex items-center justify-center border border-white/10 text-4xl">👛</div>
        <h2 className="text-2xl font-bold text-gray-400">Wallet Not Connected</h2>
        <p className="text-gray-600">Please connect your Sui wallet to view your assets.</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-8">
      <div className="bg-[#0b0e14]/90 backdrop-blur-2xl rounded-3xl border border-purple-500/20 p-8 shadow-[0_0_50px_rgba(168,85,247,0.1)] relative overflow-hidden">
        <div className="absolute top-[-50%] right-[-10%] w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="relative z-10 flex justify-between items-end mb-8">
          <div>
            <h2 className="text-3xl font-black font-tech text-white tracking-tighter mb-2 flex items-center gap-3">
              👛 My Assets
            </h2>
            <p className="text-gray-400 font-mono text-sm">Address: <span className="text-purple-400">{account.address.slice(0, 6)}...{account.address.slice(-4)}</span></p>
          </div>
          <button 
            onClick={() => { setIsLoading(true); suiClient.getAllBalances({ owner: account.address }).then(setBalances).finally(() => setIsLoading(false)); }}
            className={`bg-white/5 border border-white/10 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-white/10 transition-colors flex items-center gap-2 ${isLoading ? 'animate-pulse' : ''}`}
          >
            {isLoading ? 'Scanning...' : '↻ Refresh'}
          </button>
        </div>

        {isLoading && balances.length === 0 ? (
          <div className="text-center py-20 text-purple-400 font-mono animate-pulse">Scanning Sui Network for assets...</div>
        ) : balances.length === 0 ? (
          <div className="text-center py-20 text-gray-500 font-mono border border-dashed border-white/10 rounded-2xl">No assets found in this wallet</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {balances.map((bal, idx) => {
              const symbol = getSymbol(bal.coinType);
              const isSui = symbol === 'SUI';
              return (
                <div key={idx} className="bg-black/40 border border-white/5 p-6 rounded-2xl hover:border-purple-500/50 hover:bg-gray-900 transition-all group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${isSui ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'}`}>
                        {isSui ? '💧' : symbol.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-lg">{symbol === 'COINUSDC' ? 'USDC' : symbol === 'UNKNOWN' ? 'Custom' : symbol}</h4>
                        <p className="text-[10px] text-gray-500 font-mono truncate w-24" title={bal.coinType}>
                          {isSui ? 'Native Gas' : 'Token'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-end">
                    <span className="text-xs text-gray-500 uppercase tracking-widest font-bold">Balance</span>
                    <span className="text-2xl font-mono text-white font-bold group-hover:text-purple-400 transition-colors">
                      {formatBalance(bal.coinType, bal.totalBalance)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}