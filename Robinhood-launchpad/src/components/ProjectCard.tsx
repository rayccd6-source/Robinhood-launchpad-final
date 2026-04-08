import { useCurrentAccount } from '@mysten/dapp-kit';

export default function ProjectCard({ 
  project, 
  currentPhase, 
  onBuyPassClick, 
  onDepositClick, 
  onClaimClick 
}: { 
  project: any;
  currentPhase: number;
  onBuyPassClick: (project: any) => void;
  onDepositClick: (project: any) => void;
  onClaimClick: (project: any) => void;
}) {
  const currentAccount = useCurrentAccount();

  return (
    <div className="bg-gray-950 p-6 rounded-2xl border border-white/5 flex flex-col relative overflow-hidden group hover:border-blue-500/30 transition-colors shadow-lg">
    
      <div className="relative z-10 flex justify-between items-start mb-6">
        <div>
          <h4 className="text-2xl font-black text-white">{project.name}</h4>
          <p className="text-gray-400 text-sm">{project.description}</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-white font-bold text-2xl">${project.basePrice}</p>
          <p className="text-xs text-gray-500">Base Price</p>
        </div>
      </div>

      <div className="space-y-4 mb-6 relative z-10 flex-1">
        <div className="flex justify-between items-center bg-black/40 p-3 rounded-lg border border-white/5">
          <span className="text-xs text-gray-500">Raised</span>
          <span className="font-mono text-cyan-400 font-bold">${project.raised.toLocaleString()} / ${project.target.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center bg-black/40 p-3 rounded-lg border border-white/5">
          <span className="text-xs text-gray-500">Starts In</span>
          <span className="font-mono text-white font-bold text-sm">{project.countdown}</span>
        </div>
      </div>

      <div className="mt-2 flex flex-col gap-3">
        {currentPhase === 1 && (
          <button 
            onClick={() => {
              if (!currentAccount) {
                alert('Please connect your wallet first.');
                return;
              }
              onBuyPassClick(project);// 呼叫由 App.tsx 傳進來的函數，並把專案的資料傳過去
            }}
            className="w-full py-4 rounded-xl bg-blue-600 font-bold uppercase text-white tracking-widest transition-all hover:bg-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.4)] text-sm"
          >
            {!currentAccount ? 'Connect Wallet' : 'Secure Allocation Pass'}
          </button>
        )}

        {currentPhase === 2 && (
          <button 
            onClick={() => {
              if (!currentAccount) {
                alert('Please connect your wallet first.');
                return;
              }
              onDepositClick(project);
            }}
            className="w-full py-4 rounded-xl bg-purple-600 font-bold uppercase text-white tracking-widest transition-all hover:bg-purple-500 shadow-[0_0_15px_rgba(147,51,234,0.4)] text-sm"
          >
            {!currentAccount ? 'Connect Wallet' : 'Deposit to Jackpot'}
          </button>
        )}

        {currentPhase === 3 && (
          <button 
            onClick={() => {
              if (!currentAccount) {
                alert('Please connect your wallet first.');
                return;
              }
              onClaimClick(project);
            }}
            className="w-full py-4 rounded-xl bg-green-600 font-bold uppercase text-white tracking-widest transition-all hover:bg-green-500 shadow-[0_0_15px_rgba(22,163,74,0.4)] text-sm"
          >
            {!currentAccount ? 'Connect Wallet' : 'Claim Tokens'}
          </button>
        )}
      </div>

    </div>
  );
}