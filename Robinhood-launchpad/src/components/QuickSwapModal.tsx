import { useState, useEffect } from 'react';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from "@mysten/sui/transactions";
import { DeepBookClient } from "@mysten/deepbook-v3";
import QuickSwapModal from './QuickSwapModal'; 
import toast from 'react-hot-toast';

// 引入你的神兵利器 Hooks
import { useTransactionExecution } from '../hooks/useTransactionExecution';
import { request_faucet_suix } from '../hooks/useSuiContracts'; 

export default function AlphaSwap() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const executeTransaction = useTransactionExecution(); 

  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  
  const [tradeType, setTradeType] = useState<'market' | 'limit'>('market');
  const [payAmount, setPayAmount] = useState<string>('');
  const [receiveAmount, setReceiveAmount] = useState<string>('');
  const [limitPrice, setLimitPrice] = useState<string>('');
  const [timeframe, setTimeframe] = useState<'15M' | '1H' | '4H' | '1D'>('1H');
  
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastTxId, setLastTxId] = useState('');

  const [placedLimitOrders, setPlacedLimitOrders] = useState<{symbol: string, price: number}[]>([]);  // 記錄成功掛單價格

  const marketTokens = [
    { symbol: 'SUIX', name: 'SuiX Exchange', price: 0.082, icon: '🚀', desc: 'Deep liquidity DEX utility token', change: '+12.5%', vol: '$2.4M' },
    { symbol: 'MOVE', name: 'MoveCraft Arena', price: 2.15, icon: '🎮', desc: 'AAA Game governance & currency', change: '+5.2%', vol: '$1.1M' },
    { symbol: 'CETUS', name: 'Cetus Protocol', price: 0.124, icon: '🐋', desc: 'Concentrated liquidity protocol', change: '-1.2%', vol: '$8.9M' },
    { symbol: 'SUI', name: 'Sui Network', price: 1.85, icon: '💧', desc: 'Native token for gas & staking', change: '+2.8%', vol: '$145M' },
  ];

  const activeToken = marketTokens.find(t => t.symbol === selectedToken);

  const generateMockCandles = (startPrice: number) => {
    let basePrice = startPrice;
    const vol = startPrice * 0.05; 
    return Array.from({ length: 40 }).map((_) => {
      const open = basePrice;
      const close = basePrice + (Math.random() - 0.45) * vol;
      const high = Math.max(open, close) + Math.random() * (vol / 2);
      const low = Math.min(open, close) - Math.random() * (vol / 2);
      basePrice = close;
      return { open, close, high, low, isUp: close >= open };
    });
  };

  const [candles, setCandles] = useState<any[]>([]);

  useEffect(() => { 
    if (activeToken) setCandles(generateMockCandles(activeToken.price)); 
  }, [timeframe, selectedToken]);

  const handlePayChange = (val: string) => {
    setPayAmount(val);
    if (!val || !activeToken) return setReceiveAmount('');
    const effectivePrice = tradeType === 'limit' && limitPrice ? Number(limitPrice) : activeToken.price;
    setReceiveAmount((Number(val) / effectivePrice).toFixed(4));
  };

  const handleLimitPriceChange = (val: string) => {
    setLimitPrice(val);
    if (payAmount && val) setReceiveAmount((Number(payAmount) / Number(val)).toFixed(4));
  };

  const targetPrice = Number(limitPrice);
  const isBuyCrossMarket = tradeType === 'limit' && limitPrice && targetPrice >= activeToken!.price;
  const shouldExecuteAsMarket = tradeType === 'market' || isBuyCrossMarket;

  const handleAction = async () => {
    if (!account || !activeToken || !payAmount) return;
    
    try {
      const tx = new Transaction();
      let isRestingLimit = false;

      const USDC_COIN_TYPE = "0x4cd131c02b60d5c38514db55b814d2ce127d5f1b5ec70cf7707d3380da482380::coinusdc::COINUSDC";

      toast.loading("Waiting for wallet confirmation...", { id: "swap" });

      if (!shouldExecuteAsMarket) {
        const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(1)]); 
        tx.transferObjects([coin], account.address);
        isRestingLimit = true;
      } 
      else {
        if (activeToken.symbol === 'SUI') {
          const deepbook = new DeepBookClient({ client: suiClient, address: account.address, env: 'testnet' });
          const amountInMists = Math.floor(Number(payAmount) * 1_000_000);
          const [baseOut, quoteOut, deepOut] = deepbook.swapExactQuoteForBase({
            poolKey: 'SUI_DBUSDC', amount: amountInMists, deepAmount: 1000000, minOut: 0, 
          })(tx);
          tx.transferObjects([baseOut, quoteOut, deepOut], account.address);
        } 
        else if (activeToken.symbol === 'SUIX') {
          const coins = await suiClient.getCoins({ owner: account.address, coinType: USDC_COIN_TYPE });
          if (coins.data.length === 0) {
            toast.dismiss("swap"); 
            toast.error("Insufficient USDC balance!", { id: "swap" });
            return;
          }
          const payAmountMists = Math.floor(Number(payAmount) * 1_000_000);
          const [payCoin] = tx.splitCoins(tx.object(coins.data[0].coinObjectId), [tx.pure.u64(payAmountMists)]); 
          const TREASURY_ADDRESS = "0x0000000000000000000000000000000000000000000000000000000000000000";
          tx.transferObjects([payCoin], TREASURY_ADDRESS); 
          const mintAmountMists = Math.floor(Number(receiveAmount) * 1_000_000);
          await request_faucet_suix(tx, mintAmountMists);
        } 
        else {
          const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(1)]);
          tx.transferObjects([coin], account.address);
        }
      }
      
      const res = await executeTransaction(tx);
      toast.dismiss("swap");

      if (res) {
        setLastTxId(res.digest);
        setShowSuccess(true);
        if (isRestingLimit) {
          setPlacedLimitOrders(prev => [...prev, { symbol: activeToken.symbol, price: targetPrice }]);
        }
      }
    } catch (error: any) {
      toast.dismiss("swap"); 
      console.log("Transaction failed or rejected by user:", error);
      toast.error(`Transaction Cancelled`, { id: "swap-error" });
    }
  };

  if (!selectedToken) {
    return (
      <div className="space-y-6 animate-fade-in relative z-10">
        <h2 className="text-3xl font-black font-tech text-white tracking-tighter mb-2">Alpha Trading</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {marketTokens.map(token => (
            <div 
              key={token.symbol} 
              onClick={() => { setSelectedToken(token.symbol); setLimitPrice(token.price.toString()); }} 
              className="bg-gray-950/70 backdrop-blur-xl p-6 rounded-2xl border border-white/10 hover:border-cyan-500/50 hover:bg-gray-900 transition-all cursor-pointer group shadow-lg"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-4">
                  <span className="text-4xl group-hover:scale-110 transition-transform">{token.icon}</span>
                  <div><h4 className="font-bold text-white text-xl">{token.symbol}</h4><p className="text-xs text-gray-500">{token.name}</p></div>
                </div>
                <div className="text-right"><p className="font-mono text-white font-bold text-lg">${token.price}</p><p className={`text-xs font-mono font-bold ${token.change.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>{token.change}</p></div>
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-white/5"><p className="text-sm text-gray-400">{token.desc}</p><span className="text-xs font-mono text-gray-500">Vol: {token.vol}</span></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  let maxHigh = candles.length > 0 ? Math.max(...candles.map(c => c.high)) : 0;
  let minLow = candles.length > 0 ? Math.min(...candles.map(c => c.low)) : 0;

  const relevantOrders = placedLimitOrders.filter(o => o.symbol === activeToken?.symbol);  // 如果有已經掛好的單，自動擴大圖表範圍包容它
  if (relevantOrders.length > 0) {
    const maxOrder = Math.max(...relevantOrders.map(o => o.price));
    const minOrder = Math.min(...relevantOrders.map(o => o.price));
    if (maxOrder > maxHigh) maxHigh = maxOrder * 1.05; 
    if (minOrder < minLow) minLow = minOrder * 0.95;
  }

  if (tradeType === 'limit' && limitPrice && Number(limitPrice) > 0) { // 如果正在輸入限價則自動擴大範圍，讓預覽線顯示出來
    const lp = Number(limitPrice);
    if (lp > maxHigh) maxHigh = lp * 1.05;
    if (lp < minLow) minLow = lp * 0.95;
  }

  const range = maxHigh - minLow || 1; 

  return (
    <>
      <div className="bg-[#0b0e14]/90 backdrop-blur-2xl rounded-2xl border border-white/5 shadow-2xl overflow-hidden animate-fade-in flex flex-col relative z-10">
        <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-black/20 gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => setSelectedToken(null)} className="text-gray-500 hover:text-white px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-sm font-bold">← Back</button>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{activeToken?.icon}</span>
              <h3 className="text-xl font-bold text-white font-tech tracking-wide">{activeToken?.symbol}<span className="text-gray-500 text-sm ml-2">/ USDC</span></h3>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
            {['15M', '1H', '4H', '1D'].map(tf => (
              <button key={tf} onClick={() => setTimeframe(tf as any)} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${timeframe === tf ? 'bg-cyan-600/20 text-cyan-400' : 'text-gray-500 hover:text-gray-300'}`}>{tf}</button>
            ))}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row">
          <div className="flex-1 p-6 border-b lg:border-b-0 lg:border-r border-white/5 relative min-h-[350px] flex flex-col bg-black/10 overflow-hidden">
            <div className="flex justify-between text-[10px] font-mono text-gray-500 mb-4 tracking-widest uppercase pb-2 border-b border-white/5 relative z-20">
              <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#00ff88]"></span> Live Cetus Index</span>
              <span>H: ${maxHigh.toFixed(3)} &nbsp;&nbsp; L: ${minLow.toFixed(3)}</span>
            </div>
            
            <div className="flex-1 w-full flex relative z-0">
              <div className="w-14 h-full flex flex-col justify-between text-[10px] font-mono text-gray-600 pb-2 pt-1 pr-2 border-r border-white/5">
                <span>{maxHigh.toFixed(3)}</span>
                <span>{((maxHigh + minLow) / 2).toFixed(3)}</span>
                <span>{minLow.toFixed(3)}</span>
              </div>

              <div className="flex-1 h-full flex items-end justify-between gap-[2px] relative ml-2">

                {relevantOrders.map((order, idx) => {
                  const bottomOffset = ((order.price - minLow) / range) * 100;
                  return (
                    <div key={`limit-${idx}`} className="absolute w-full border-b-[1.5px] border-dashed border-purple-500/80 z-10 left-0" style={{ bottom: `${bottomOffset}%` }}>
                      <div className="absolute right-0 -top-5 bg-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-[0_0_10px_rgba(168,85,247,0.5)]">
                        LMT: ${order.price.toFixed(3)}
                      </div>
                    </div>
                  );
                })}

                {tradeType === 'limit' && limitPrice && !isBuyCrossMarket && (
                  <div className="absolute w-full border-b-[1.5px] border-dashed border-orange-500/50 z-10 left-0 animate-pulse" style={{ bottom: `${((Number(limitPrice) - minLow) / range) * 100}%` }}>
                    <div className="absolute right-0 -top-5 bg-orange-500 text-black text-[10px] font-bold px-2 py-0.5 rounded shadow-[0_0_10px_rgba(249,115,22,0.5)]">
                      PREVIEW: ${Number(limitPrice).toFixed(3)}
                    </div>
                  </div>
                )}

                {candles.map((candle, idx) => {
                  const heightPercent = ((candle.high - candle.low) / range) * 100;
                  const bodyHeightPercent = (Math.abs(candle.close - candle.open) / range) * 100;
                  const bottomOffset = ((Math.min(candle.open, candle.close) - minLow) / range) * 100;
                  const wickBottomOffset = ((candle.low - minLow) / range) * 100;
                  const colorClass = candle.isUp ? 'bg-[#00ff88]/80' : 'bg-[#ff4d4d]/80';
                  return (
                    <div key={idx} className="relative flex-1 flex justify-center h-full items-end group cursor-crosshair">
                      <div className={`absolute w-[1px] ${candle.isUp ? 'bg-[#00ff88]/50' : 'bg-[#ff4d4d]/50'}`} style={{ height: `${heightPercent}%`, bottom: `${wickBottomOffset}%` }}></div>
                      <div className={`absolute w-full max-w-[6px] rounded-[1px] ${colorClass}`} style={{ height: `${Math.max(bodyHeightPercent, 1)}%`, bottom: `${bottomOffset}%` }}></div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="w-full lg:w-[360px] p-6 bg-[#0f131a] flex flex-col space-y-6">
            <div className="flex gap-2">
              <button onClick={() => setIsSwapModalOpen(true)} className="flex-1 py-3 rounded-xl font-bold text-sm bg-black/40 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-950/30 transition-all flex items-center justify-center gap-2">
                💱 Swap
              </button>
              <button onClick={() => setTradeType('market')} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${tradeType === 'market' ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.3)]' : 'bg-transparent text-gray-500 hover:text-gray-300'}`}>
                Market
              </button>
              <button onClick={() => setTradeType('limit')} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${tradeType === 'limit' ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.3)]' : 'bg-transparent text-gray-500 hover:text-gray-300'}`}>
                Limit
              </button>
            </div>

            <div className="space-y-4 flex-1 mt-2">
              {tradeType === 'limit' && (
                <div className={`bg-black/40 p-4 rounded-xl border transition-colors animate-fade-in ${isBuyCrossMarket ? 'border-orange-500/50' : 'border-purple-500/30'}`}>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 flex justify-between">
                    <span>Target Price (USDC)</span>
                    {isBuyCrossMarket && <span className="text-orange-400">⚠️ Execute at Market</span>}
                  </label>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500 font-mono text-xl">$</span>
                    <input type="number" value={limitPrice} onChange={(e) => handleLimitPriceChange(e.target.value)} className="bg-transparent text-2xl font-mono text-white focus:outline-none w-full placeholder-gray-700" placeholder="0.00" />
                  </div>
                </div>
              )}

              <div className={`bg-black/40 p-4 rounded-xl border border-white/5 transition-colors focus-within:border-cyan-500/30`}>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">You Pay</label>
                <div className="flex justify-between items-center gap-3">
                  <input type="number" value={payAmount} onChange={(e) => handlePayChange(e.target.value)} className="bg-transparent text-2xl font-mono text-white focus:outline-none w-full placeholder-gray-700" placeholder="0.0" />
                  <div className="bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 font-bold text-white shrink-0 text-sm">USDC</div>
                </div>
              </div>

              <div className="flex justify-center -my-3 relative z-10">
                <div className="bg-gray-800 w-8 h-8 rounded-full flex items-center justify-center border border-white/5 text-gray-400 text-sm">↓</div>
              </div>

              <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">You Receive</label>
                <div className="flex justify-between items-center gap-3">
                  <input type="number" value={receiveAmount} readOnly className="bg-transparent text-2xl font-mono text-gray-500 focus:outline-none w-full placeholder-gray-700" placeholder="0.0" />
                  <div className={`px-3 py-1.5 rounded-lg border font-bold shrink-0 text-sm ${tradeType === 'market' || isBuyCrossMarket ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' : 'bg-purple-500/10 border-purple-500/20 text-purple-400'}`}>
                    {activeToken?.symbol}
                  </div>
                </div>
              </div>
            </div>

            <button 
              onClick={handleAction}
              disabled={!account || !payAmount || (tradeType === 'limit' && !limitPrice)} 
              className={`w-full py-4 rounded-xl font-bold uppercase tracking-widest transition-all ${
                !account || !payAmount ? 'bg-cyan-950/30 text-cyan-700 border border-cyan-900/50 cursor-not-allowed' : 
                isBuyCrossMarket ? 'bg-orange-500 hover:bg-orange-400 text-black shadow-[0_0_20px_rgba(249,115,22,0.4)]' :
                'bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_20px_rgba(6,182,212,0.4)]'
              }`}
            >
              {!account ? 'Connect Wallet' : !payAmount ? 'Enter Amount' : isBuyCrossMarket ? 'Cross Market - Execute Now' : tradeType === 'limit' ? 'Place Limit Order' : 'Execute Market Order'}
            </button>
          </div>
        </div>
      </div>

      {showSuccess && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-gray-900 border border-green-500/30 w-full max-w-sm rounded-3xl p-8 text-center shadow-[0_0_50px_rgba(34,197,94,0.2)] relative overflow-hidden">
            <div className="absolute top-[-20%] left-[-20%] w-40 h-40 bg-green-600/20 rounded-full blur-3xl pointer-events-none"></div>
            <div className="relative z-10">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/30">
                <span className="text-4xl">✅</span>
              </div>
              <h3 className="text-2xl font-black text-white mb-2 tracking-tight">Order Confirmed</h3>
              <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                Your {tradeType} order for <span className="text-white font-bold">{activeToken?.symbol}</span> has been signed & submitted to Sui Network.
              </p>
              <div className="bg-black/40 p-3 rounded-xl mb-8 border border-white/5 overflow-hidden">
                <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Transaction ID</p>
                <p className="text-xs font-mono text-cyan-400 truncate break-all">{lastTxId}</p>
              </div>
              <button 
                onClick={() => setShowSuccess(false)}
                className="w-full py-3.5 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-all font-tech tracking-wider uppercase text-sm"
              >
                Back to Terminal
              </button>
            </div>
          </div>
        </div>
      )}

      {isSwapModalOpen && (
        <QuickSwapModal 
          defaultToken={activeToken?.symbol || 'SUIX'} 
          onClose={() => setIsSwapModalOpen(false)} 
        />
      )}
    </>
  );
}