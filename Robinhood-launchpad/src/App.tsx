import { useState, useEffect } from 'react'; 
import { ConnectButton, useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SuiClientProvider, WalletProvider, createNetworkConfig } from '@mysten/dapp-kit';
import { Transaction } from "@mysten/sui/transactions";
import { Toaster } from "react-hot-toast";
import toast from "react-hot-toast";
import '@mysten/dapp-kit/dist/index.css';

import ProjectCard from './components/ProjectCard';
import LotteryBoard from './components/LotteryBoard';
import AlphaSwap from './components/AlphaSwap'; 
import ProtocolDocs from './components/ProtocolDocs'; 
import WalletDashboard from './components/WalletDashboard'; 

import { useTransactionExecution } from './hooks/useTransactionExecution';
import { 
  request_faucet,
  withdraw_from_project_treasury,
  place_bid,
  settle_auction_by_winners,
  claim_refund,
  deposit_pure_pool,
  claim_project_tokens,
  force_next_phase,
  lottery_draw,
  claim_lottery_prize, 
  USDC_COIN_TYPE,
  PROJECT_TREASURY_SHARED_ID,
  INVOICE_TREASURY_ID,
  LAUNCHPAD_SHARED_ID,
  INVOICE_PACKAGE_ID,
  INVOICE_SYSTEM_ID 
} from './hooks/useSuiContracts'; 

const MY_BOSS_WALLET_ADDRESS = "0xb4dbade52e1cc8d33ceb408bf330bc3005b7aba93ef5429acaa77b9405786e54"; 
const MY_ADMIN_CAP_ID = "0xbb61c0f3c78ed5294c1ebb455313bf134b5fda4c942a924e600dadf65e321f18";

// 1. 建立 QueryClient
const queryClient = new QueryClient();

// 2. 設定網路
const { networkConfig } = createNetworkConfig({
  testnet: { 
    url: "https://fullnode.testnet.sui.io:443",
    network: "testnet" as any 
  },
  mainnet: { 
    url: "https://fullnode.mainnet.sui.io:443",
    network: "mainnet" as any
  },
});

function AppContent() {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient(); 
  const executeTransaction = useTransactionExecution();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  
  const [winningInvoiceId, setWinningInvoiceId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'trending' | 'trading' | 'docs' | 'wallet'>('trending'); 
  const [showFaucetModal, setShowFaucetModal] = useState(false);
  
  const [currentPhase, setCurrentPhase] = useState<number>(0);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  
  const [showBuyPassModal, setShowBuyPassModal] = useState(false);
  const [priorityFee, setPriorityFee] = useState<string>('');
  
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [jackpotDepositAmount, setJackpotDepositAmount] = useState<string>('');

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastTxId, setLastTxId] = useState('');

  const [showWrongPhaseModal, setShowWrongPhaseModal] = useState(false);
  const [wrongPhaseMessage, setWrongPhaseMessage] = useState({ title: '', desc: '' });

  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [winnersInput, setWinnersInput] = useState<string>(''); 
  const [treasuryBalance, setTreasuryBalance] = useState<number>(0);
  const [jackpotBalance, setJackpotBalance] = useState<number>(0); 
  
  const isBoss = currentAccount?.address?.toLowerCase() === MY_BOSS_WALLET_ADDRESS.toLowerCase();

  // ==========================================
  // 🌟 自動對獎系統 (已掛載超強裝甲與 Log)
  // ==========================================
  const checkWinStatus = async () => {
    if (!currentAccount) {
      setWinningInvoiceId(null);
      return;
    }
    try {
      const sysObj = await suiClient.getObject({ id: INVOICE_SYSTEM_ID, options: { showContent: true } });
      const sysContent = sysObj.data?.content as any;
      console.log("👉 [對獎雷達] 系統物件資料:", sysContent);

      const rawWinner = sysContent?.fields?.winner;
      console.log("👉 [對獎雷達] 合約上的原始 Winner 欄位:", rawWinner);

      if (rawWinner === undefined || rawWinner === null) {
        console.log("👉 [對獎雷達] 尚未開獎，Winner 為空。");
        return;
      }

      // 🛡️ 裝甲級解析：處理 String, Number, Array, 或是 Option<u64> 的奇葩結構
      let winningNumbers: string[] = [];
      if (Array.isArray(rawWinner)) {
        winningNumbers = rawWinner.map(String);
      } else if (typeof rawWinner === 'object' && rawWinner !== null && rawWinner.fields?.vec) {
        // 處理 Option 結構 { fields: { vec: ["1"] } }
        winningNumbers = rawWinner.fields.vec.map(String);
      } else {
        winningNumbers = [String(rawWinner)];
      }
      console.log("👉 [對獎雷達] 成功解析出的中獎號碼清單:", winningNumbers);

      if (winningNumbers.length === 0) return;

      const ownedInvoices = await suiClient.getOwnedObjects({
        owner: currentAccount.address,
        filter: { StructType: `${INVOICE_PACKAGE_ID}::invoice::Invoice` },
        options: { showContent: true }
      });
      console.log(`👉 [對獎雷達] 找到錢包內有 ${ownedInvoices.data.length} 張發票`);

      let foundWinner = null;
      for (const inv of ownedInvoices.data) {
        const invContent = inv.data?.content as any;
        const myInvoiceNum = String(invContent?.fields?.invoice_number);
        
        console.log(`🔍 [對獎比對] 你的發票號碼: ${myInvoiceNum} vs 中獎號碼:`, winningNumbers);

        // 強制全部轉成字串比對，拒絕型別錯誤！
        if (winningNumbers.includes(myInvoiceNum)) {
          foundWinner = inv.data?.objectId;
          console.log("🎉 [對獎成功] 找到中獎發票，發票 Object ID:", foundWinner);
          break;
        }
      }
      
      setWinningInvoiceId(foundWinner || null);
    } catch (error) {
      console.error("Auto-check lottery failed:", error);
    }
  };

  const fetchBalances = async () => { 
    try {
      if (isBoss) {
        const obj = await suiClient.getObject({ id: PROJECT_TREASURY_SHARED_ID, options: { showContent: true } });
        const content = obj.data?.content as any;
        if (content && content.fields && content.fields.pool !== undefined) {
          let val = 0;
          if (typeof content.fields.pool === 'object' && content.fields.pool !== null) {
            val = Number(content.fields.pool.fields?.value || 0);
          } else {
            val = Number(content.fields.pool);
          }
          setTreasuryBalance(val / 1_000_000); 
        }
      }

      const invObj = await suiClient.getObject({ id: INVOICE_TREASURY_ID, options: { showContent: true } });
      const invContent = invObj.data?.content as any;
      if (invContent && invContent.fields && invContent.fields.pool !== undefined) {
        let val = 0;
        if (typeof invContent.fields.pool === 'object' && invContent.fields.pool !== null) {
          val = Number(invContent.fields.pool.fields?.value || 0);
        } else {
          val = Number(invContent.fields.pool);
        }
        setJackpotBalance(val / 1_000_000); 
      }

      const lpObj = await suiClient.getObject({ id: LAUNCHPAD_SHARED_ID, options: { showContent: true } });
      const lpContent = lpObj.data?.content as any;
      if (lpContent && lpContent.fields && lpContent.fields.phase !== undefined) {
        setCurrentPhase(Number(lpContent.fields.phase));
      }

      await checkWinStatus();
    } catch(e) {
      console.error("Failed to fetch balances and phase:", e);
    }
  };

  useEffect(() => {
    fetchBalances();
    const interval = setInterval(fetchBalances, 10000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBoss, suiClient, currentAccount]); 
  
  const handleNextPhase = async () => {
    if (!currentAccount || !isBoss) return;
    try {
      toast.loading("Advancing to the next phase...", { id: "phase" });
      const tx = new Transaction();
      force_next_phase(tx);
      const res = await signAndExecuteTransaction({ transaction: tx });
      
      if (res) {
        toast.success("Phase advanced successfully!", { id: "phase" });
        fetchBalances();
      }
    } catch (e: any) {
      toast.error(`Phase change failed.`, { id: "phase" });
      console.error(e);
    }
  };

  const handleAutoCalculateWinners = async () => {
    try {
      toast.loading("Fetching all bids from blockchain...", { id: "calc" });
      
      const lpObj = await suiClient.getObject({ id: LAUNCHPAD_SHARED_ID, options: { showContent: true } });
      const lpContent = lpObj.data?.content as any;
      const bidsTableId = lpContent?.fields?.bids?.fields?.id?.id;
      
      if (!bidsTableId) {
        toast.error("No bids found or contract not initialized properly.", { id: "calc" });
        return;
      }

      const dynamicFields = await suiClient.getDynamicFields({ parentId: bidsTableId });
      let allBids: { address: string, amount: number }[] = [];

      for (const field of dynamicFields.data) {
        const fieldObject = await suiClient.getObject({ id: field.objectId, options: { showContent: true } });
        const fieldData = fieldObject.data?.content as any;
        
        const address = fieldData?.fields?.name; 
        const amount = Number(fieldData?.fields?.value); 
        
        if (address && amount) {
          allBids.push({ address, amount });
        }
      }

      if (allBids.length === 0) {
        toast.error("No active bids in the pool.", { id: "calc" });
        return;
      }

      allBids.sort((a, b) => b.amount - a.amount);
      const TOP_N = 1000;      
      const winners = allBids.slice(0, TOP_N).map(bid => bid.address);

      setWinnersInput(winners.join(', '));
      toast.success(`Calculated! Top ${winners.length} winners loaded.`, { id: "calc" });

    } catch (error) {
      console.error(error);
      toast.error("Failed to calculate winners.", { id: "calc" });
    }
  };

  const handleSettleAuction = async () => {
    if (!currentAccount || !isBoss) return;
    if (!winnersInput.trim()) {
      toast.error("Please input at least one winner address.");
      return;
    }
    
    try {
      const addresses = winnersInput.split(',').map(addr => addr.trim()).filter(addr => addr.length > 0);
      toast.loading(`Settling auction for ${addresses.length} winners...`, { id: "settle" });
      
      const tx = new Transaction();
      settle_auction_by_winners(tx, addresses);
      const res = await signAndExecuteTransaction({ transaction: tx });
      
      if (res) {
        toast.success("Auction Settled Successfully!", { id: "settle" });
        setWinnersInput('');
        fetchBalances();
      }
    } catch (e: any) {
      toast.error(`Failed to settle auction.`, { id: "settle" });
      console.error(e);
    }
  };

  const handleDrawLottery = async () => {
    if (!currentAccount || !isBoss) return;
    try {
      toast.loading("Drawing Jackpot Winner...", { id: "lottery" });
      const tx = new Transaction();
      lottery_draw(tx);
      const res = await signAndExecuteTransaction({ transaction: tx });
      
      if (res) {
        toast.success("Lottery Drawn Successfully! Winners selected.", { id: "lottery" });
        fetchBalances(); 
      }
    } catch (e: any) {
      toast.error(`Lottery draw failed.`, { id: "lottery" });
      console.error(e);
    }
  };

  const handleClaimLottery = async () => {
    if (!currentAccount || !winningInvoiceId) return;
    try {
      toast.loading("Claiming your Jackpot...", { id: "claimLottery" });
      const tx = new Transaction();
      claim_lottery_prize(tx, winningInvoiceId); 
      const res = await signAndExecuteTransaction({ transaction: tx });
      
      if (res) {
        toast.success(`Jackpot Claimed! The prize has been sent to your wallet.`, { id: "claimLottery" });
        setWinningInvoiceId(null); 
        fetchBalances(); 
      }
    } catch (e: any) {
      toast.error("Claim failed. You might not be the winner.", { id: "claimLottery" });
      console.error(e);
    }
  };

  const handleClaimRefund = async () => {
    if (!currentAccount) return;
    try {
      toast.loading("Processing Refund...", { id: "refund" });
      const tx = new Transaction();
      claim_refund(tx, currentAccount.address);
      const res = await signAndExecuteTransaction({ transaction: tx });
      
      if (res) {
        toast.success(`USDC Refunded Successfully!`, { id: "refund" });
        fetchBalances(); 
      }
    } catch (e: any) {
      console.error(e);
      const errMsg = String(e);
      if (errMsg.includes("abort code: 9")) {
        toast.error("Refund Failed: You have no valid bids to refund, or you already refunded.", { id: "refund" });
      } else {
        toast.error("Refund failed. Check console for details.", { id: "refund" });
      }
    }
  };

  const handleFaucetRequest = async () => {
    if (!currentAccount) return;
    try {
      toast.loading("Requesting USDC from Faucet...", { id: "faucet" });
      const tx = new Transaction();
      await request_faucet(tx);
      toast.loading("Please approve the transaction in your wallet", { id: "faucet" });
      const res = await executeTransaction(tx);
      
      if (res) {
        toast.success("Faucet successful!", { id: "faucet" });
        setShowFaucetModal(true);
      } else {
        toast.dismiss("faucet");
      }
    } catch (error: any) {
      console.error(error);
      toast.error(`Faucet failed: ${error.message}`, { id: "faucet" });
    }
  };

  const handleAdminWithdraw = async () => {
    const amountNum = Number(withdrawAmount);
    if (!currentAccount || !withdrawAmount || amountNum <= 0 || amountNum > treasuryBalance) return;
    
    try {
      const tx = new Transaction();
      toast.loading("Withdrawing funds...", { id: "withdraw" });
      
      const amountMists = Math.floor(amountNum * 1_000_000);
      withdraw_from_project_treasury(
        tx, 
        MY_ADMIN_CAP_ID, 
        amountMists, 
        currentAccount.address,
        USDC_COIN_TYPE,
        PROJECT_TREASURY_SHARED_ID
      );

      const res = await executeTransaction(tx);
      toast.dismiss("withdraw");
      if (res) {
        toast.success("Withdrawal Successful!", { id: "withdraw-success" });
        setWithdrawAmount('');
        fetchBalances();
      }
    } catch (error) {
      toast.dismiss("withdraw");
      toast.error("Withdrawal failed! Check AdminCap.");
      console.error(error);
    }
  };

  const handleBuyPassClick = (project: any) => {
    if (currentPhase !== 1) {
      setWrongPhaseMessage({ 
        title: `Not in Phase 1 (Current: ${currentPhase})`, 
        desc: 'Priority Pass Bidding is only available during Phase 1.' 
      });
      setShowWrongPhaseModal(true);
      return;
    }
    setSelectedProject(project);
    setShowBuyPassModal(true);
  };

  const handleDepositClick = (project: any) => {
    if (currentPhase !== 2) {
      setWrongPhaseMessage({ 
        title: `Not in Phase 2 (Current: ${currentPhase})`, 
        desc: 'Jackpot Pool deposits are only available during Phase 2.' 
      });
      setShowWrongPhaseModal(true);
      return;
    }
    setSelectedProject(project);
    setShowDepositModal(true);
  };

  const handleClaimClick = () => {
    if (currentPhase !== 3) {
      setWrongPhaseMessage({ 
        title: `Not in Phase 3 (Current: ${currentPhase})`, 
        desc: 'Token claiming, settlement, and refunds are only available during Phase 3.' 
      });
      setShowWrongPhaseModal(true);
      return;
    }
    executeClaim();
  };

  const executePlaceBid = async () => {
    if (!currentAccount || !selectedProject) return;
    try {
      toast.loading("Preparing bid transaction...", { id: "tx" });
      const tx = new Transaction();
      const basePriceMists = selectedProject.basePrice * 1_000_000;
      const priorityFeeMists = (Number(priorityFee) || 0) * 1_000_000;
      const totalAmountMists = basePriceMists + priorityFeeMists;

      const coinsRes = await suiClient.getCoins({
        owner: currentAccount.address,
        coinType: USDC_COIN_TYPE,
      });

      if (coinsRes.data.length === 0) {
        toast.error("錢包內沒有 USDC！請先使用 Faucet 領取。", { id: "tx" });
        return;
      }

      const coinIds = coinsRes.data.map(c => c.coinObjectId);
      const mainCoin = tx.object(coinIds[0]);

      if (coinIds.length > 1) {
        const restCoins = coinIds.slice(1).map(id => tx.object(id));
        tx.mergeCoins(mainCoin, restCoins);
      }

      const [paymentCoin] = tx.splitCoins(mainCoin, [tx.pure.u64(totalAmountMists)]);

      place_bid(tx, paymentCoin);

      toast.loading("Waiting for wallet signature...", { id: "tx" });
      const res = await signAndExecuteTransaction({ transaction: tx });
      
      toast.success("Bid Placed Successfully!", { id: "tx" });
      setLastTxId(res.digest);
      setShowBuyPassModal(false);
      setPriorityFee('');
      setShowSuccessModal(true);
      fetchBalances(); 
    } catch (error: any) {
      console.error("Bid placement failed:", error);
      toast.error(`Transaction failed. Check console for details.`, { id: "tx" });
    }
  };

  const executeDeposit = async () => {
    if (!currentAccount || !selectedProject) return;
    try {
      const depositNum = Number(jackpotDepositAmount);
      if (depositNum <= 0) {
        alert("Please enter a valid amount.");
        return;
      }

      toast.loading("Preparing transaction...", { id: "tx" });
      const tx = new Transaction();
      
      const coinsRes = await suiClient.getCoins({
        owner: currentAccount.address,
        coinType: USDC_COIN_TYPE,
      });

      if (coinsRes.data.length === 0) {
        toast.error("錢包內沒有 USDC！請先使用 Faucet 領取。", { id: "tx" });
        return;
      }

      const coinIds = coinsRes.data.map(c => c.coinObjectId);
      const mainCoin = tx.object(coinIds[0]);
      if (coinIds.length > 1) {
        const restCoins = coinIds.slice(1).map(id => tx.object(id));
        tx.mergeCoins(mainCoin, restCoins);
      }

      deposit_pure_pool(tx, coinIds[0], depositNum);

      toast.loading("Waiting for wallet signature...", { id: "tx" });
      const res = await signAndExecuteTransaction({ transaction: tx });
      
      toast.success("Deposit Successful!", { id: "tx" });
      setLastTxId(res.digest);
      setShowDepositModal(false);
      setJackpotDepositAmount('');
      setShowSuccessModal(true);
      fetchBalances(); 
    } catch (error: any) {
      console.error("Jackpot deposit failed:", error);
      const errMsg = String(error);
      if (errMsg.includes("abort code: 10")) {
        toast.error("Deposit Failed: Exceeds the maximum deposit limit per wallet!", { id: "tx" });
      } else {
        toast.error(`Transaction failed. Check console for details.`, { id: "tx" });
      }
    }
  };

  const executeClaim = async () => {
    if (!currentAccount) return;
    try {
      const tx = new Transaction();
      claim_project_tokens(tx, currentAccount.address);

      toast.loading("Waiting for wallet signature...", { id: "tx" });
      const res = await signAndExecuteTransaction({ transaction: tx });
      
      toast.success("Tokens Claimed Successfully!", { id: "tx" });
      setLastTxId(res.digest);
      setShowSuccessModal(true);
    } catch (error: any) {
      console.error("Claim tokens failed:", error);
      const errMsg = String(error);
      if (errMsg.includes("abort code: 3")) {
        toast.error("You have ALREADY claimed your tokens!", { id: "tx" });
      } else if (errMsg.includes("abort code: 4")) {
        toast.error("Nothing to claim. You didn't win the auction or deposit in the pool.", { id: "tx" });
      } else {
        toast.error("Claim failed. Check console for details.", { id: "tx" });
      }
    }
  };

  const activeProjects = [
    { 
      id: 1, name: 'SuiX Exchange', description: 'The deep liquidity DEX native to Sui network.', 
      details: { overview: 'SuiX leverages Sui\'s native object model to deliver institution-grade liquidity.', roadmap: 'Phase 1: Launch DEX Core (Q2 2026).', tokenomics: 'Total Supply: 1,000,000,000 SUIX.' },
      basePrice: 10, target: 150000, raised: 124500, countdown: '02d 14h 35m',
      timeline: [
        { phase: 'Priority Pass Bidding', date: 'Mar 24 - Mar 26', status: currentPhase === 1 ? 'active' : 'completed' },
        { phase: 'Pure Pool Lottery', date: 'Mar 27 - Mar 28', status: currentPhase === 2 ? 'active' : (currentPhase < 2 ? 'upcoming' : 'completed') },
        { phase: 'Settlement & Refund', date: 'Mar 30, 2026', status: currentPhase === 3 ? 'active' : 'upcoming' }
      ],
      status: 'Trending' 
    }
  ];

  const withdrawAmountNum = Number(withdrawAmount);
  const isExceedingBalance = withdrawAmountNum > treasuryBalance;
  const isWithdrawDisabled = !withdrawAmount || withdrawAmountNum <= 0 || isExceedingBalance;

  return (
    <div className="min-h-screen text-white relative overflow-hidden bg-[#05070a]">
      <Toaster position="top-right" toastOptions={{ style: { background: '#1f2937', color: '#fff' } }} />

      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-600/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-purple-600/10 rounded-full blur-[100px] pointer-events-none"></div>

      <nav className="relative z-10 flex justify-between items-center p-6 border-b border-white/10 bg-black/30 backdrop-blur-md">
        <h1 className="text-3xl font-black text-transparent bg-clip-text `bg-linear-to-r` from-blue-400 to-cyan-300 cursor-pointer" onClick={() => setActiveTab('trending')}>
          RobinHood.Pad
        </h1>
        
        <div className="flex items-center gap-4">
          {currentAccount && (
            <button 
              onClick={handleFaucetRequest}
              className="px-4 py-2 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-xl text-sm font-bold hover:bg-blue-500/20 transition-all flex items-center gap-2"
            >
              🚰 Faucet
            </button>
          )}
          <ConnectButton />
        </div>
      </nav>

      <main className="relative z-10 container mx-auto px-4 py-16 space-y-16">
        <section className="text-center space-y-5">
          <h2 className="text-5xl md:text-6xl font-extrabold mb-6 tracking-tight"> 
            Discover Alpha. <span className="text-blue-500">Share the Wealth.</span>
          </h2>
          <p className="text-gray-400 text-lg md:text-xl max-w-3xl mx-auto leading-relaxed">
            The ultimate community-first Launchpad for high-potential Web3 projects. Secure your token allocation with a Priority Fee, or join the Jackpot Pool.
          </p>

          <div className="mt-8 pt-4 flex flex-col md:flex-row gap-6 justify-center items-center">
            
            <div className="bg-yellow-500/10 border border-yellow-500/30 px-6 py-3 rounded-2xl flex items-center gap-3 shadow-[0_0_15px_rgba(234,179,8,0.2)]">
              <span className="text-2xl">🏆</span>
              <div className="flex flex-col text-left">
                <span className="text-[10px] text-yellow-500/80 font-bold uppercase tracking-widest">Global Jackpot Pool</span>
                <span className="text-yellow-400 font-mono text-xl font-black">
                  ${jackpotBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} 
                  <span className="text-sm text-yellow-600 ml-1">USDC</span>
                </span>
              </div>
            </div>

            {isBoss && (
              <button 
                onClick={handleNextPhase} 
                className="bg-red-600/20 hover:bg-red-600 border border-red-500/50 text-red-400 hover:text-white font-bold px-6 py-3 rounded-2xl transition-all shadow-[0_0_15px_rgba(220,38,38,0.3)] flex items-center gap-2"
              >
                ⏭️ Advance Phase (Current On-Chain Phase: {currentPhase})
              </button>
            )}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="col-span-2 space-y-8">
            <div className="flex flex-wrap gap-x-8 gap-y-4 border-b border-white/5 pb-4">
              <button onClick={() => setActiveTab('trending')} className={`text-xl md:text-2xl font-bold tracking-wide flex items-center gap-2 transition-all duration-300 ${activeTab === 'trending' ? 'text-white border-l-4 border-blue-500 pl-3 drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'text-gray-600 hover:text-gray-400 pl-3 border-l-4 border-transparent'}`}>
                🔥 TRENDING
              </button>
              <button onClick={() => setActiveTab('trading')} className={`text-xl md:text-2xl font-bold tracking-wide flex items-center gap-2 transition-all duration-300 ${activeTab === 'trading' ? 'text-cyan-400 border-l-4 border-cyan-400 pl-3 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]' : 'text-gray-600 hover:text-gray-400 pl-3 border-l-4 border-transparent'}`}>
                📈 TRADING
              </button>
              <button onClick={() => setActiveTab('docs')} className={`text-xl md:text-2xl font-bold tracking-wide flex items-center gap-2 transition-all duration-300 ${activeTab === 'docs' ? 'text-yellow-400 border-l-4 border-yellow-400 pl-3 drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]' : 'text-gray-600 hover:text-gray-400 pl-3 border-l-4 border-transparent'}`}>
                💡 HOW IT WORKS
              </button>
              <button onClick={() => setActiveTab('wallet')} className={`text-xl md:text-2xl font-bold tracking-wide flex items-center gap-2 transition-all duration-300 ${activeTab === 'wallet' ? 'text-purple-400 border-l-4 border-purple-400 pl-3 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'text-gray-600 hover:text-gray-400 pl-3 border-l-4 border-transparent'}`}>
                👛 WALLET
              </button>
            </div>

            <div className="animate-fade-in `min-h-100`">
              {activeTab === 'trending' && (
                <div className="space-y-6">
                  
                  {currentPhase === 3 && currentAccount && (
                    <div className="bg-red-900/20 border border-red-500/30 p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4 animate-fade-in shadow-[0_0_20px_rgba(220,38,38,0.1)]">
                      <div>
                        <h4 className="text-red-400 font-bold uppercase tracking-widest text-sm mb-1">Didn't win the auction?</h4>
                        <p className="text-xs text-gray-400">Claim your refunded USDC from your unsuccessful bids.</p>
                      </div>
                      <button 
                        onClick={handleClaimRefund} 
                        className="w-full sm:w-auto px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all shadow-[0_0_10px_rgba(220,38,38,0.4)] text-sm tracking-wide"
                      >
                        Claim Refund
                      </button>
                    </div>
                  )}

                  {activeProjects.map(proj => (
                    <ProjectCard 
                      key={proj.id} 
                      project={proj} 
                      currentPhase={currentPhase}
                      onBuyPassClick={() => handleBuyPassClick(proj)}      
                      onDepositClick={() => handleDepositClick(proj)}      
                      onClaimClick={() => handleClaimClick()}          
                    />
                  ))}
                </div>
              )}
              {activeTab === 'trading' && <AlphaSwap />}
              {activeTab === 'docs' && <ProtocolDocs />}
              {activeTab === 'wallet' && <WalletDashboard />}
            </div>
          </div>
          
          <div className="hidden lg:block">
            {activeTab !== 'wallet' && (
              <LotteryBoard 
                jackpotBalance={jackpotBalance} 
                isBoss={isBoss} 
                onDrawLottery={handleDrawLottery}
                onClaimPrize={handleClaimLottery} 
                winningInvoiceId={winningInvoiceId} 
              />
            )}
          </div>
        </div>
      </main>

      {/* 👑 老闆專屬提款與結算後台 */}
      {isBoss && (
        <div className="fixed bottom-6 right-6 z-[100] w-80 bg-gray-900/95 backdrop-blur-xl border border-blue-500/30 p-5 rounded-2xl shadow-[0_0_30px_rgba(59,130,246,0.2)] animate-fade-in">
          {/* ... 後台內容保持不變 ... */}
          <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">👑</span>
              <h3 className="text-blue-400 font-bold tracking-widest text-sm uppercase">Admin Panel</h3>
            </div>
            <button onClick={fetchBalances} className="text-xs text-gray-500 hover:text-white transition-colors" title="Refresh Balance">
              🔄
            </button>
          </div>
          
          <div className="mb-4">
            <div className="flex justify-between items-end mb-2">
              <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Withdraw (USDC)</label>
              <div className="text-right">
                <span className="text-[9px] text-gray-500 font-mono block">Balance</span>
                <span className="text-xs text-cyan-400 font-mono font-bold">{treasuryBalance.toFixed(2)}</span>
              </div>
            </div>
            
            <div className="relative mb-3">
              <input 
                type="number" 
                value={withdrawAmount} 
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className={`w-full bg-black/50 border rounded-lg pl-3 pr-14 py-2 text-white font-mono text-sm focus:outline-none ${isExceedingBalance ? 'border-red-500 text-red-400' : 'border-white/10 focus:border-cyan-500/50'}`}
                placeholder="0.00"
              />
              <button 
                onClick={() => setWithdrawAmount(treasuryBalance.toString())}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-cyan-500/20 text-cyan-400 hover:text-white text-[10px] font-bold px-2 py-1 rounded transition-colors"
              >
                MAX
              </button>
            </div>
            
            <button 
              onClick={handleAdminWithdraw}
              disabled={isWithdrawDisabled}
              className={`w-full font-bold py-2 rounded-lg transition-colors text-xs tracking-wider uppercase ${isWithdrawDisabled ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-blue-500/20 border border-blue-500/50 hover:bg-blue-500 text-blue-100 hover:text-white'}`}
            >
              Withdraw to Wallet
            </button>
          </div>

          <div className="mt-4 border-t border-white/10 pt-4">
            <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest flex justify-between">
              <span>Settle Auction</span>
              <span className="text-green-500 font-mono">Phase 2 Only</span>
            </label>
            
            <button
              onClick={handleAutoCalculateWinners}
              disabled={currentPhase !== 2}
              className={`w-full mt-2 font-bold py-1.5 rounded-lg transition-colors text-[10px] uppercase tracking-widest ${currentPhase !== 2 ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-purple-500/20 border border-purple-500/50 hover:bg-purple-500 text-purple-100 hover:text-white'}`}
            >
              🪄 Auto-Fill Top 1000
            </button>

            <textarea
              value={winnersInput}
              onChange={(e) => setWinnersInput(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-white font-mono text-xs focus:outline-none focus:border-green-500/50 mt-2 placeholder-gray-600"
              placeholder="0xWinner1..., 0xWinner2..."
              rows={2}
            />
            <button
              onClick={handleSettleAuction}
              disabled={currentPhase !== 2}
              className={`w-full mt-2 font-bold py-2 rounded-lg transition-colors text-xs uppercase tracking-widest ${currentPhase !== 2 ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-green-500/20 border border-green-500/50 hover:bg-green-500 text-green-100 hover:text-white'}`}
            >
              Confirm Winners
            </button>
          </div>
        </div>
      )}

      {/* ⚠️ 防呆階段錯誤提示視窗 */}
      {showWrongPhaseModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="bg-[#0b0e14]/95 border border-orange-500/30 w-full max-w-sm rounded-3xl p-8 text-center shadow-[0_0_40px_rgba(249,115,22,0.15)] relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-gradient-to-r from-transparent via-orange-500 to-transparent"></div>
            
            <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-5 border border-orange-500/20 text-3xl">
              ⏳
            </div>
            <h3 className="text-xl font-black text-white mb-3 tracking-tight uppercase">
              {wrongPhaseMessage.title}
            </h3>
            <p className="text-gray-400 text-sm mb-8 leading-relaxed px-2">
              {wrongPhaseMessage.desc}
            </p>
            <button 
              onClick={() => setShowWrongPhaseModal(false)} 
              className="w-full py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-xl transition-all tracking-widest uppercase text-xs shadow-inner"
            >
              Understood
            </button>
          </div>
        </div>
      )}

      {/* 💧 Faucet 成功 Modal */}
      {showFaucetModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-gray-900 border border-blue-500/30 w-full max-w-sm rounded-3xl p-8 text-center shadow-[0_0_50px_rgba(59,130,246,0.2)]">
            <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-500/30"><span className="text-4xl">💧</span></div>
            <h3 className="text-2xl font-black text-white mb-2 tracking-tight">Faucet Success</h3>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">1,000 <span className="text-white font-bold">USDC</span> test tokens have been airdropped to your wallet.</p>
            <button onClick={() => setShowFaucetModal(false)} className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-all font-tech tracking-wider uppercase text-sm">
              Start Trading
            </button>
          </div>
        </div>
      )}

      {/* 🎟️ 拍賣競標 Modal */}
      {showBuyPassModal && selectedProject && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0b0e14] border border-blue-500/30 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden p-6 space-y-5">
            <div className="flex justify-between items-center border-b border-white/5 pb-4">
               <h3 className="text-lg font-bold text-white uppercase tracking-wider">Place Priority Bid</h3>
               <button onClick={() => setShowBuyPassModal(false)} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>
            
            <div className="bg-black/50 p-4 rounded-xl border border-blue-500/20">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-blue-400 border border-blue-500/30 bg-blue-950/30 px-2 py-1 rounded-md uppercase tracking-widest">Base Price</span>
                <span className="font-mono text-white text-xl font-bold">${selectedProject.basePrice} <span className="text-gray-500 text-xs">USDC</span></span>
              </div>
              <p className="text-gray-400 text-xs leading-relaxed mt-2">Place your bid for a guaranteed allocation. If you do not win the auction, your funds will be fully refundable in Phase 3.</p>
            </div>

            <div className="bg-black/40 p-4 rounded-xl border border-white/5 focus-within:border-cyan-500/30 transition-colors">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <span className="text-cyan-400 text-sm">+</span> Priority Fee (Your Bid)
              </label>
              <div className="flex justify-between items-center gap-3">
                <input 
                  type="number" 
                  value={priorityFee} 
                  onChange={(e) => setPriorityFee(e.target.value)} 
                  className="bg-transparent text-2xl font-mono text-white focus:outline-none w-full placeholder-gray-700" 
                  placeholder="0.0" 
                />
                <div className="bg-blue-600/20 px-3 py-1.5 rounded-lg border border-blue-500/30 font-bold text-blue-400 shrink-0 text-sm flex items-center gap-2">
                  💵 USDC
                </div>
              </div>
            </div>

            <button onClick={executePlaceBid} className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold tracking-widest uppercase transition-all shadow-[0_0_15px_rgba(37,99,235,0.4)]">
              Sign & Place Bid
            </button>
          </div>
        </div>
      )}

      {/* 🏦 Pure Pool 存款 Modal */}
      {showDepositModal && selectedProject && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0b0e14] border border-purple-500/30 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden p-6 space-y-5">
            <div className="flex justify-between items-center border-b border-white/5 pb-4">
               <h3 className="text-lg font-bold text-white uppercase tracking-wider">Join Jackpot Pool</h3>
               <button onClick={() => setShowDepositModal(false)} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>

            <div className="bg-black/50 p-4 rounded-xl border border-purple-500/20">
               <p className="text-gray-400 text-xs leading-relaxed">
                 Deposit USDC directly into the Jackpot Pool. Allocation is proportional to your share of the total pool and is not guaranteed. 
                 <br/><span className="text-purple-400 font-bold mt-2 inline-block">Max deposit per wallet applies.</span>
               </p>
            </div>

            <div className="bg-black/40 p-4 rounded-xl border border-white/5 focus-within:border-purple-500/30 transition-colors">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                Deposit Amount
              </label>
              <div className="flex justify-between items-center gap-3">
                <input 
                  type="number" 
                  value={jackpotDepositAmount} 
                  onChange={(e) => setJackpotDepositAmount(e.target.value)} 
                  className="bg-transparent text-2xl font-mono text-white focus:outline-none w-full placeholder-gray-700" 
                  placeholder="0.0" 
                />
                <div className="bg-purple-600/20 px-3 py-1.5 rounded-lg border border-purple-500/30 font-bold text-purple-400 shrink-0 text-sm flex items-center gap-2">
                  💵 USDC
                </div>
              </div>
            </div>

            <button onClick={executeDeposit} className="w-full py-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold tracking-widest uppercase transition-all shadow-[0_0_15px_rgba(147,51,234,0.4)]">
              Confirm Deposit
            </button>
          </div>
        </div>
      )}

      {/* ✅ 交易成功 Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-gray-900 border border-green-500/30 w-full max-w-sm rounded-3xl p-8 text-center shadow-2xl">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-5 border border-green-500/30">
              <span className="text-3xl">✅</span>
            </div>
            <h3 className="text-2xl font-black text-white mb-2 tracking-tight">Transaction Success!</h3>
            <p className="text-gray-400 text-sm mb-6">Your operation on {selectedProject?.name} was completed.</p>
            <div className="bg-black/40 rounded-xl p-3 mb-6 border border-white/5">
              <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">TXID</p>
              <p className="text-xs font-mono text-cyan-400 truncate">{lastTxId}</p>
            </div>
            <button onClick={() => setShowSuccessModal(false)} className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 uppercase text-sm tracking-wider">Close</button>
          </div>
        </div>
      )}

    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
        <WalletProvider>
          <AppContent />
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}