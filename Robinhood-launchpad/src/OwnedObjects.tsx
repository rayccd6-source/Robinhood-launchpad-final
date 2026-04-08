import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./components/card";
import { Package, Loader2 } from "lucide-react";

export function OwnedObjects() {
  const account = useCurrentAccount();
  const client = useSuiClient() as any; // 強制斷言以相容舊版或自定義 Client

  const { data, isPending, error } = useQuery({
    queryKey: ["ownedObjects", account?.address],
    queryFn: async () => {
      if (!account?.address) return null;

      // 修正：所有的非同步 API 呼叫必須待在 queryFn 內
      const response = await client.getOwnedObjects({
        owner: account.address,
      });
      
      // Sui API 回傳的結構通常在 data 欄位
      return response.data ?? [];
    },
    enabled: !!account?.address,
  });

  if (!account) {
    return null;
  }

  return (
    <Card className="bg-gray-900/50 border-white/10 text-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl font-bold">
          <Package className="h-5 w-5 text-cyan-400" />
          Owned Objects
        </CardTitle>
        <CardDescription className="text-gray-400">
          Objects owned by: {account.address.slice(0, 6)}...{account.address.slice(-4)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-red-400 bg-red-400/10 p-3 rounded-lg border border-red-400/20">
            Error: {(error as Error)?.message || "Unknown error"}
          </p>
        ) : isPending ? (
          <div className="flex items-center gap-2 text-cyan-400/60 py-4">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="font-medium">Fetching objects from Sui...</span>
          </div>
        ) : data && data.length === 0 ? (
          <p className="text-gray-500 py-4 italic text-center border border-dashed border-white/5 rounded-xl">
            No objects found in this wallet.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {data?.map((object: any) => (
              <div
                key={object.data?.objectId || Math.random()}
                className="rounded-xl border border-white/5 bg-black/40 p-4 hover:border-cyan-500/30 transition-all group"
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest">Object ID</span>
                  <span className="text-[10px] text-gray-500 font-mono group-hover:text-gray-300 transition-colors">
                    Type: {object.data?.type?.split('::').pop() || 'Unknown'}
                  </span>
                </div>
                <p className="font-mono text-sm text-gray-300 break-all leading-relaxed">
                  {object.data?.objectId}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}