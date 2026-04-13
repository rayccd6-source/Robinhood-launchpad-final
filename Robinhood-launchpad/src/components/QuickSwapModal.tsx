import { useState } from 'react';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from "@mysten/sui/transactions";
import toast from 'react-hot-toast';

// 引入你的後端 Hook
import { useTransactionExecution } from '../hooks/useTransactionExecution';
import { request_faucet_suix, deposit_to_project_treasury } from '../hooks/useSuiContracts'; 

const LOCAL_USDC_COIN_TYPE = "0x8cae9de2c7a9d48d52bbc391486fc5d3fab420d5b34e1ee956e1dc85a10800f2::coinusdc::COINUSDC";
const LOCAL_PROJECT_TREASURY_SHARED_ID = "0x1d4d07ca5e7873ef2506e0f2344d44047be1d1a826071f168e73ac7e500db2b8";

interface QuickSwapModalProps {
  onClose: () => void;
  defaultToken?: string;
}

export default function QuickSwapModal({ onClose, defaultToken = 'SUIX' }: QuickSwapModalProps) {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const executeTransaction = useTransactionExecution();

  const [payAmount, setPayAmount] = useState<string>('');
  const [receiveToken, setReceiveToken] = useState<string>(defaultToken);
  const [isExecuting, setIsExecuting] = useState(false);
  const [successTxId, setSuccessTxId] = useState<string>('');

  // 延續 AlphaSwap 的代幣資料
  const tokens = [
    { symbol: 'SUIX', price: 0.082, icon: '🚀' },
    { symbol: 'MOVE', price: 2.15, icon: '🎮' },
    { symbol: 'CETUS', price: 0.124, icon: '🐋' },
    { symbol: 'SUI', price: 1.85, icon: '💧' },
  ];

  const activeTokenObj = tokens.find(t => t.symbol === receiveToken) || tokens[0];

  // 計算邏輯
  const totalPayAmount = Number(payAmount) || 0;
  const tradingFee = totalPayAmount * 0.001; // 0.1% 手續費
  const swapBaseAmount = totalPayAmount - tradingFee; 
  const expectedReceiveAmount = swapBaseAmount > 0 
    ? (swapBaseAmount / activeTokenObj.price).toFixed(4) 
    : '';

  // ==========================================
  // 🚀 執行 Swap (呼叫真實後端合約)
  // ==========================================
  const handleSwap = async () => {
    if (!account) return toast.error("Please connect wallet first!");
    if (!payAmount || totalPayAmount <= 0) return toast.error("Enter a valid amount");

    setIsExecuting(true);
    const toastId = toast.loading("Confirming Swap in Wallet...");

    try {
      const tx = new Transaction();
      
      // 1. 抓取使用者的 USDC
      const coins = await suiClient.getCoins({ owner: account.address, coinType: LOCAL_USDC_COIN_TYPE });
      if (coins.data.length === 0) {
        toast.error("Insufficient USDC balance! Use Faucet first.", { id: toastId });
        setIsExecuting(false);
        return;
      }

      const userUsdcCoinId = coins.data[0].coinObjectId;
      const totalPayMists = Math.floor(totalPayAmount * 1_000_000);
      const projectFeeMists = Math.floor(tradingFee * 1_000_000);
      const baseAmountMists = totalPayMists - projectFeeMists;

      // 2. 切割代幣 (手續費 + 實際交換額)
      const splitAmounts = [];
      if (projectFeeMists > 0) splitAmounts.push(tx.pure.u64(projectFeeMists));
      if (baseAmountMists > 0) splitAmounts.push(tx.pure.u64(baseAmountMists));

      const splits = tx.splitCoins(tx.object(userUsdcCoinId), splitAmounts);
      let splitIdx = 0;

      // 3. 將 0.1% 費用打入專案國庫 (Treasury)
      if (projectFeeMists > 0) {
        deposit_to_project_treasury(tx, splits[splitIdx++], LOCAL_USDC_COIN_TYPE, LOCAL_PROJECT_TREASURY_SHARED_ID);
      }

      // 4. 處理剩餘的交換額
      if (baseAmountMists > 0) {
        const baseCoin = splits[splitIdx++];
        const BURN_ADDRESS = "0x0000000000000000000000000000000000000000000000000000000000000000";
        // 把 USDC 打入黑洞 (模擬購買消耗)
        tx.transferObjects([baseCoin], tx.pure.address(BURN_ADDRESS));

        // 5. 如果是 SUIX，直接呼叫 Mint；其他代幣則當作 Mock Swap
        if (receiveToken === 'SUIX') {
          const mintAmountMists = Math.floor(Number(expectedReceiveAmount) * 1_000_000);
          await request_faucet_suix(tx, mintAmountMists);
        }
      }

      // 6. 執行交易
      const res = await executeTransaction(tx);
      
      if (res) {
        toast.success("Swap Executed Successfully!", { id: toastId });
        setSuccessTxId(res.digest);
      } else {
        toast.dismiss(toastId);
      }

    } catch (error) {
      console.error("Swap failed:", error);
      toast.error("Swap Cancelled or Failed", { id: toastId });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      {/* 點擊背景關閉 */}
      <div className="absolute inset-0" onClick={onClose}></div>

      <div className="relative w-full max-w-md bg-[#0b0e14] border border-white/10 rounded-3xl shadow-[0_0_50px_rgba(6,182,212,0.15)] overflow-hidden">
        
        {/* 背景光暈 */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-cyan-600/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-purple-600/20 rounded-full blur-3xl pointer-events-none"></div>

        {successTxId ? (
          // ==============================
          // 🎉 成功畫面
          // ==============================
          <div className="p-8 flex flex-col items-center justify-center text-center relative z-10 animate-fade-in">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6 border border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.3)]">
              <span className="text-4xl">⚡</span>
            </div>
            <h3 className="text-2xl font-black text-white mb-2">Swap Successful</h3>
            <p className="text-gray-400 text-sm mb-6">
              Successfully swapped <span className="text-white font-bold">{payAmount} USDC</span> for <span className="text-cyan-400 font-bold">{expectedReceiveAmount} {receiveToken}</span>
            </p>
            
            <div className="w-full bg-black/40 p-3 rounded-xl mb-8 border border-white/5 overflow-hidden">
              <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Transaction Digest</p>
              <p className="text-xs font-mono text-cyan-400 truncate break-all">{successTxId}</p>
            </div>

            <button onClick={onClose} className="w-full py-3.5 bg-cyan-500 text-black font-bold rounded-xl hover:bg-cyan-400 transition-all font-tech tracking-wider uppercase text-sm">
              Done
            </button>
          </div>
        ) : (
          // ==============================
          // 💱 Swap 畫面
          // ==============================
          <div className="p-6 relative z-10">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                ⚡ Quick Swap
              </h3>
              <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors bg-white/5 w-8 h-8 rounded-full flex items-center justify-center">✕</button>
            </div>

            <div className="space-y-4">
              {/* Pay Section */}
              <div className="bg-black/40 p-4 rounded-2xl border border-white/5 focus-within:border-cyan-500/30 transition-colors">
                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">You Pay</label>
                <div className="flex justify-between items-center gap-4">
                  <input 
                    type="number" 
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="bg-transparent text-3xl font-mono text-white focus:outline-none w-full placeholder-gray-800"
                    placeholder="0.0"
                  />
                  <div className="bg-[#1a1f2e] px-4 py-2 rounded-xl border border-white/10 font-bold text-white flex items-center gap-2 shrink-0">
                    <span className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-[10px]">💵</span>
                    USDC
                  </div>
                </div>
              </div>

              {/* Arrow */}
              <div className="flex justify-center -my-3 relative z-10">
                <div className="bg-[#0b0e14] w-10 h-10 rounded-full flex items-center justify-center border border-white/10 text-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.2)]">
                  ↓
                </div>
              </div>

              {/* Receive Section */}
              <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-gray-500 uppercase">You Receive</label>
                  <span className="text-[10px] text-cyan-500 bg-cyan-500/10 px-2 py-0.5 rounded font-mono">1 {receiveToken} = ${activeTokenObj.price}</span>
                </div>
                <div className="flex justify-between items-center gap-4">
                  <input 
                    type="number" 
                    value={expectedReceiveAmount}
                    readOnly
                    className="bg-transparent text-3xl font-mono text-gray-400 focus:outline-none w-full placeholder-gray-800"
                    placeholder="0.0"
                  />
                  <select 
                    value={receiveToken}
                    onChange={(e) => setReceiveToken(e.target.value)}
                    className="bg-[#1a1f2e] px-3 py-2.5 rounded-xl border border-white/10 font-bold text-white focus:outline-none shrink-0 appearance-none cursor-pointer hover:border-cyan-500/30 transition-colors"
                  >
                    {tokens.map(t => (
                      <option key={t.symbol} value={t.symbol}>{t.icon} {t.symbol}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Fee Breakdown */}
              {payAmount && Number(payAmount) > 0 && (
                <div className="pt-2 px-1 animate-fade-in space-y-1">
                  <div className="flex justify-between text-xs text-gray-500 font-mono">
                    <span>Protocol Fee (0.1%)</span>
                    <span>{tradingFee.toFixed(4)} USDC</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 font-mono">
                    <span>Amount after Fee</span>
                    <span>{swapBaseAmount.toFixed(4)} USDC</span>
                  </div>
                </div>
              )}
            </div>

            {/* Action Button */}
            <button 
              onClick={handleSwap}
              disabled={isExecuting || !account || !payAmount || Number(payAmount) <= 0}
              className={`w-full mt-6 py-4 rounded-xl font-bold uppercase tracking-widest transition-all ${
                isExecuting 
                  ? 'bg-cyan-900/50 text-cyan-500 cursor-not-allowed animate-pulse'
                  : !account || !payAmount || Number(payAmount) <= 0
                    ? 'bg-white/5 text-gray-500 border border-white/10 cursor-not-allowed' 
                    : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:scale-[1.02]'
              }`}
            >
              {!account 
                ? 'Wallet Disconnected' 
                : isExecuting 
                  ? 'Executing Swap...' 
                  : !payAmount || Number(payAmount) <= 0 
                    ? 'Enter Amount' 
                    : 'Confirm Swap'
              }
            </button>
          </div>
        )}
      </div>
    </div>
  );
}