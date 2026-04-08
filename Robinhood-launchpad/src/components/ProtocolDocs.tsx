export default function ProtocolDocs() {
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="text-center space-y-4 mb-12">
        <h2 className="text-4xl font-black font-tech text-white tracking-tighter">
          The <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">RobinHood</span> Manifesto
        </h2>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
          We believe in a fair Web3 ecosystem where high-conviction investors secure their allocations, while the broader community shares the generated wealth.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-950/70 backdrop-blur-xl p-8 rounded-3xl border border-white/10 hover:border-blue-500/50 transition-all shadow-[0_0_30px_rgba(59,130,246,0.1)] group">
          <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center text-3xl mb-6 border border-blue-500/20 group-hover:scale-110 transition-transform">
            ⚖️
          </div>
          <h3 className="text-xl font-bold text-white mb-3 font-tech">1. The Philosophy</h3>
          <p className="text-gray-400 leading-relaxed text-sm">
            Traditional launchpads allow whales to sweep allocations, leaving retail with nothing. RobinHood Pad flips the script. Whales must pay a <strong className="text-blue-400">Priority Fee</strong> to secure their bags. This fee isn't burned—it is redistributed.
          </p>
        </div>

        <div className="bg-gray-950/70 backdrop-blur-xl p-8 rounded-3xl border border-white/10 hover:border-purple-500/50 transition-all shadow-[0_0_30px_rgba(168,85,247,0.1)] group">
          <div className="w-14 h-14 bg-purple-500/10 rounded-2xl flex items-center justify-center text-3xl mb-6 border border-purple-500/20 group-hover:scale-110 transition-transform">
            🎲
          </div>
          <h3 className="text-xl font-bold text-white mb-3 font-tech">2. Dual Bidding System</h3>
          <ul className="text-gray-400 leading-relaxed text-sm space-y-3">
            <li>
              <span className="text-cyan-400 font-bold">🎫 Allocation Pass:</span> Pay the Base Price + an optional Priority Fee to guarantee your token allocation.
            </li>
            <li>
              <span className="text-purple-400 font-bold">🎰 Jackpot Pool:</span> Don't want the token? Buy a lottery ticket. Your funds go to the treasury, and you stand a chance to win the massive Jackpot.
            </li>
          </ul>
        </div>

        <div className="bg-gray-950/70 backdrop-blur-xl p-8 rounded-3xl border border-white/10 hover:border-yellow-500/50 transition-all shadow-[0_0_30px_rgba(234,179,8,0.1)] md:col-span-2 group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/5 rounded-full blur-[80px] pointer-events-none"></div>
          <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
            <div className="w-16 h-16 bg-yellow-500/10 rounded-2xl flex items-center justify-center text-4xl border border-yellow-500/20 shrink-0 group-hover:rotate-12 transition-transform">
              💰
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-white mb-3 font-tech">3. Transparent Fee Structure</h3>
              <p className="text-gray-400 leading-relaxed text-sm mb-4">
                Every single USDC collected from Priority Fees and Pool Tickets is routed securely via Sui Move Smart Contracts. Zero human intervention.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 bg-black/50 p-4 rounded-xl border border-white/5 flex items-center justify-between">
                  <span className="text-yellow-400 font-bold text-lg">80%</span>
                  <span className="text-gray-500 text-xs uppercase tracking-widest font-bold">To Community Jackpot</span>
                </div>
                <div className="flex-1 bg-black/50 p-4 rounded-xl border border-white/5 flex items-center justify-between">
                  <span className="text-blue-400 font-bold text-lg">20%</span>
                  <span className="text-gray-500 text-xs uppercase tracking-widest font-bold">Protocol Treasury</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}