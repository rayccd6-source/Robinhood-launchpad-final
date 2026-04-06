import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./components/ui/card";
import {
  Coins,
  Ticket,
  Receipt,
  Trophy,
  ArrowRightLeft,
} from "lucide-react";

export function InvoiceBoard() {
  const [usdcAmount, setUsdcAmount] = useState("");
  const [taxCoinAmount, setTaxCoinAmount] = useState("");
  const [protocolName, setProtocolName] = useState("");
  const [invoiceId, setInvoiceId] = useState("");

  const handleMintUSDC = async () => {
    console.log("Minting USDC:", usdcAmount);
    // TODO: Implement USDC minting logic
  };

  const handleBuyTaxCoin = async () => {
    console.log("Buying Tax Coin with USDC:", taxCoinAmount);
    // TODO: Implement Buy Tax Coin logic
  };

  const handleCreateInvoice = async () => {
    console.log("Creating Invoice for Protocol:", protocolName);
    // TODO: Implement Create Invoice logic
  };

  const handleRunLottery = async () => {
    console.log("Running Lottery...");
    // TODO: Implement Run Lottery logic
  };

  const handleClaimPrize = async () => {
    console.log("Claiming Prize for Invoice ID:", invoiceId);
    // TODO: Implement Claim Prize logic
  };

  return (
    <div className="space-y-8 mt-8">
      <h2 className="text-2xl font-bold tracking-tight">Invoice Dashboard</h2>
      
      <div className="grid gap-4 grid-cols-2">
        {/* Mint USDC Card */}
        <Card>
          <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="h-5 w-5" />
          Mint Fake USDC
        </CardTitle>
        <CardDescription>
          Get fake USDC for testing purposes
        </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="usdc-amount" className="text-sm font-medium">Amount</label>
          <input
            id="usdc-amount"
            type="number"
            value={usdcAmount}
            onChange={(e) => setUsdcAmount(e.target.value)}
            placeholder="Ex: 1000"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        <button
          onClick={handleMintUSDC}
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2"
        >
          Mint USDC
        </button>
          </CardContent>
        </Card>

        {/* Buy Tax Coin Card */}
        <Card>
          <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowRightLeft className="h-5 w-5" />
          Buy Tax Coin
        </CardTitle>
        <CardDescription>
          Exchange USDC for TAX coins
        </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="tax-amount" className="text-sm font-medium">USDC Amount to Spend</label>
          <input
            id="tax-amount"
            type="number"
            value={taxCoinAmount}
            onChange={(e) => setTaxCoinAmount(e.target.value)}
            placeholder="Ex: 100"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        <button
          onClick={handleBuyTaxCoin}
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2"
        >
          Buy Quota
        </button>
          </CardContent>
        </Card>

        {/* Create Invoice Card */}
        <Card>
          <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Create Invoice
        </CardTitle>
        <CardDescription>
          Spend TAX coins to create invoice
        </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="protocol-name" className="text-sm font-medium">Protocol Name</label>
          <input
            id="protocol-name"
            type="text"
            value={protocolName}
            onChange={(e) => setProtocolName(e.target.value)}
            placeholder="Ex: My Protocol"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        <button
          onClick={handleCreateInvoice}
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2"
        >
          Create Invoice
        </button>
          </CardContent>
        </Card>

        {/* Claim Prize Card */}
        <Card>
          <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Claim Prize
        </CardTitle>
        <CardDescription>
          For winning invoice holders
        </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
        <div className="rounded-md bg-muted p-3">
          <div className="text-sm font-medium mb-1">Detected Winning Invoice</div>
          <div className="text-xs font-mono text-muted-foreground break-all">
            {invoiceId || "No winning invoice detected"}
          </div>
        </div>
        <button
          disabled={!invoiceId}
          onClick={handleClaimPrize}
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2"
        >
          Claim Prize
        </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
