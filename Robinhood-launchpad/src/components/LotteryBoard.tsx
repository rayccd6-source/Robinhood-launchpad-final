// 🌟 1. 擴充 Props，接收 App 傳來的領獎函數與中獎狀態
interface LotteryBoardProps {
  jackpotBalance: number;
  isBoss: boolean;
  onDrawLottery: () => void;
  onClaimPrize: () => void; 
  winningInvoiceId: string | null; 
}

export default function LotteryBoard({ 
  jackpotBalance, 
  isBoss, 
  onDrawLottery, 
  onClaimPrize, 
  winningInvoiceId 
}: LotteryBoardProps) {
  const pastWinners = [
    { address: '0x1a2b...3c4d', amount: 5000, term: 'Phase 1' },
    { address: '0x9f8e...7d6c', amount: 8200, term: 'Phase 2' },
    { address: '0x4d3c...2b1a', amount: 3100, term: 'Phase 3' },
  ];

  return (
    <div className="bg-gray-950/80 backdrop-blur-2xl rounded-3xl p-8 border border-white/10 shadow-[0_0_50px_rgba(234,179,8,0.1)] relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-[50px] pointer-events-none group-hover:bg-yellow-500/20 transition-all"></div>
      
      <div className="flex justify-between items-start mb-6 relative z-10">
        <h3 className="text-sm font-bold tracking-widest text-white/50 uppercase flex items-center gap-2">
          🏆 Jackpot Pool
        </h3>
        <div className="flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/30 px-3 py-1.5 rounded-full text-yellow-400 font-mono text-xs animate-pulse">
          <span>Draw in: 02d 14h</span>
        </div>
      </div>
      
      <div className="text-5xl font-black text-white mb-8 font-mono tracking-tighter flex items-baseline gap-2 relative z-10">
        <span className="text-yellow-400 font-normal drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]">$</span>
        <span className="drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
          {jackpotBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
        </span> 
        <span className="text-xl text-gray-600">USDC</span>
      </div>

      {/* 👑 老闆專屬按鈕 (抽獎) */}
      {isBoss && (
        <div className="mb-8 relative z-10">
          <button 
            onClick={onDrawLottery}
            className="w-full py-4 bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-black font-black tracking-widest uppercase rounded-xl shadow-[0_0_20px_rgba(234,179,8,0.4)] hover:shadow-[0_0_30px_rgba(234,179,8,0.6)] transition-all transform hover:-translate-y-1 flex justify-center items-center gap-2"
          >
            Draw Lottery Now
          </button>
        </div>
      )}

      {/* 🌟 玩家專屬魔法：只要錢包裡有中獎發票，這裡就會自動浮現領獎按鈕！ */}
      {winningInvoiceId && (
        <div className="mb-8 relative z-10 bg-cyan-900/40 p-5 rounded-2xl border border-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.3)] animate-pulse">
          <div className="text-center space-y-3">
            <h4 className="text-xl font-black text-white uppercase tracking-widest drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]">
              🎉 YOU WON THE JACKPOT!
            </h4>
            <p className="text-cyan-200 text-xs font-mono">
              Winning Ticket Detected in Wallet
            </p>
            <button 
              onClick={onClaimPrize}
              className="w-full py-3 bg-cyan-400 hover:bg-cyan-300 text-black font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_0_15px_rgba(34,211,238,0.5)]"
            >
              Claim ${jackpotBalance.toLocaleString(undefined, {minimumFractionDigits: 2})} USDC Now
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4 relative z-10">
        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-white/10 pb-2">Recent Winners</h4>
        <ul className="space-y-3 text-sm">
          {pastWinners.map((winner, idx) => (
            <li key={idx} className="flex justify-between items-center bg-black/40 p-3 rounded-xl border border-white/5 hover:border-yellow-500/30 transition-colors">
              <div className="flex flex-col">
                 <span className="text-blue-300 font-mono text-sm">{winner.address}</span>
                 <span className="text-xs text-gray-600 font-mono mt-0.5">{winner.term}</span>
              </div>
              <span className="text-green-400 font-bold font-mono text-lg drop-shadow-[0_0_5px_rgba(74,222,128,0.4)]">
                +${winner.amount}
              </span>
            </li>
          ))}
        </ul>
        
        <div className="mt-6 p-5 bg-black/50 border border-yellow-500/20 rounded-2xl shadow-inner">
          <p className="text-xs text-gray-300 leading-relaxed">
            <span className="font-bold text-yellow-400">Treasury Rules:</span> 80% of Priority Fees & Pure Pool entries fund this jackpot. Smart contracts automatically distribute funds to lucky participants. Fair & transparent.
          </p>
        </div>
      </div>
    </div>
  );
}