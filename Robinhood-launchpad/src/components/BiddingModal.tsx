import { useState } from 'react';

export default function BiddingModal({ project, onClose }: { project: any, onClose: any }) {
  const [mode, setMode] = useState<'pass' | 'pool'>('pass');
  const [taxAmount, setTaxAmount] = useState<string>('');
  const [txState, setTxState] = useState<'idle' | 'success'>('idle');
  const [receiptTotal, setReceiptTotal] = useState<number>(0);

  const handleSubmit = () => {
    const parsedTax = Number(taxAmount) || 0;
    if (mode === 'pool' && parsedTax <= 0) return;

    const totalPayment = mode === 'pass' ? project.basePrice + parsedTax : parsedTax;
    setReceiptTotal(totalPayment);
    setTxState('success');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex justify-center items-center z-50 p-4">
      <div className="bg-gray-950 border border-white/10 rounded-3xl max-w-lg w-full shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        
        <div className="p-5 sm:p-6 border-b border-white/10 flex justify-between items-center bg-gray-900/50 shrink-0">
          <h2 className="text-xl font-bold font-tech text-white">
            {txState === 'success' ? 'Transaction Receipt' : <>Join <span className="text-cyan-400">{project.name}</span></>}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-2xl transition-colors leading-none">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0">
          {txState === 'success' ? (
            <div className="p-8 sm:p-10 flex flex-col items-center justify-center space-y-6 animate-fade-in bg-gradient-to-b from-green-900/20 to-transparent">
              <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center border border-green-500/50 shadow-[0_0_40px_rgba(34,197,94,0.3)]">
                <span className="text-4xl text-green-400">✓</span>
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-bold text-green-400 font-tech tracking-wider">SUCCESS</h3>
                <p className="text-gray-400 text-sm uppercase tracking-widest">Transaction Confirmed</p>
              </div>
              <div className="bg-black/50 p-5 rounded-2xl border border-white/5 w-full text-center space-y-2 shadow-inner">
                <p className="text-sm text-blue-400 font-bold uppercase tracking-wider">
                  {mode === 'pass' ? 'Allocation Secured' : 'Ticket Acquired'}
                </p>
                <p className="text-3xl font-mono text-white font-black">
                  {receiptTotal} <span className="text-lg text-gray-500 font-normal">USDC</span>
                </p>
              </div>
              <button onClick={onClose} className="w-full py-3.5 rounded-xl font-bold text-gray-300 bg-white/5 hover:bg-white/10 border border-white/10 transition-all uppercase tracking-widest text-sm mt-2">
                Return to Dashboard
              </button>
            </div>
          ) : (
            <div className="p-6 space-y-5">
              
              <div className="flex bg-gray-900 rounded-xl p-1 border border-white/5 shrink-0">
                <button onClick={() => { setMode('pass'); setTaxAmount(''); }} className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all ${mode === 'pass' ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}>Secure Allocation Pass</button>
                <button onClick={() => { setMode('pool'); setTaxAmount(''); }} className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all ${mode === 'pool' ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}>Jackpot Pool Only</button>
              </div>

              <div className="space-y-4 animate-fade-in">
                <p className="text-sm text-gray-400 leading-relaxed"> 
                  {mode === 'pass' ? 'Guarantee your token allocation by adding a Priority Fee. 80% of these fees fuel the Jackpot Pool.' : 'Skip the token allocation and enter the Pure Jackpot Pool. Win massive rewards!'}
                </p>

                {mode === 'pass' && (
                  <div className="flex justify-between items-center bg-black/40 p-4 rounded-xl border border-white/5">
                    <span className="text-gray-400 text-sm">Base Price (Required)</span>
                    <span className="font-mono font-bold text-white text-lg">{project.basePrice} USDC</span>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <label className={`font-bold text-sm uppercase tracking-wider ${mode === 'pass' ? 'text-cyan-400' : 'text-purple-400'}`}>
                    {mode === 'pass' ? '➕ Add Priority Fee' : '🎟️ Ticket Amount'}
                  </label>
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <input 
                        type="number" min="0" value={taxAmount} 
                        onChange={(e) => setTaxAmount(e.target.value)} onKeyDown={handleKeyDown}
                        className={`w-full bg-black/50 border rounded-xl p-3.5 text-white focus:outline-none font-mono text-xl transition-colors ${mode === 'pass' ? 'border-blue-500/30 focus:border-cyan-400' : 'border-purple-500/30 focus:border-pink-400'}`}
                        placeholder={mode === 'pass' ? 'Optional Fee' : 'Min 1 USDC'}
                      />
                    </div>
                    <button onClick={handleSubmit} className={`px-6 rounded-xl font-bold shadow-lg transition-transform hover:scale-105 active:scale-95 text-white ${mode === 'pass' ? 'bg-cyan-600 shadow-cyan-500/20' : 'bg-purple-600 shadow-purple-500/20'}`}>
                      Confirm
                    </button>
                  </div>
                </div>

                <div className="pt-4 flex justify-between items-end border-t border-white/5">
                  <span className="text-gray-500 text-sm font-bold uppercase tracking-widest">Total Due</span>
                  <span className="text-3xl font-black font-mono text-white">
                    {mode === 'pass' ? project.basePrice + (Number(taxAmount) || 0) : (Number(taxAmount) || 0)} 
                    <span className="text-sm text-gray-500 ml-2">USDC</span>
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}