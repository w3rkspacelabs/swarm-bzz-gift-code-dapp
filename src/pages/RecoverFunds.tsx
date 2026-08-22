import { useState } from "react";
import type { RecoveryFormData } from "../components/RecoveryForm";
import { parsePrivateKeys } from "../lib/walletUtils";
import { drain, type DrainResult } from "../lib/blockchainUtils";
import { useWalletConnection } from "../hooks/useWalletConnection";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { getGlobalRpcUrl } from "../components/WalletBalanceCard";

export function RecoverFunds() {
  const [isLoading, setIsLoading] = useState(false);
  const [recoveryResults, setRecoveryResults] = useState<DrainResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentProgress, setCurrentProgress] = useState<{
    current: number;
    total: number;
    processing: boolean;
  }>({ current: 0, total: 0, processing: false });
  const [form, setForm] = useState<RecoveryFormData>({
    privateKeys: "",
  });
  const { address, isConnected, isCorrectNetwork } = useWalletConnection();

  function handleChange(
    e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setRecoveryResults([]);
    setIsLoading(true);

    try {
      if (!isConnected) throw new Error("Please connect your wallet first");
      if (!isCorrectNetwork) throw new Error("Please switch to Gnosis Chain");
      if (!address) throw new Error("No wallet address available");

      const privateKeys = parsePrivateKeys(form.privateKeys);
      if (privateKeys.length === 0)
        throw new Error("No valid private keys found");

      const results: DrainResult[] = [];

      // Initialize progress
      setCurrentProgress({
        current: 0,
        total: privateKeys.length,
        processing: true,
      });

      // Process each wallet using the drain function
      for (let i = 0; i < privateKeys.length; i++) {
        const privateKey = privateKeys[i];
        console.log(
          `Starting drain for wallet ${i + 1}/${privateKeys.length}...`
        );

        try {
          // Use the drain function to recover all funds from the wallet
          const result = await drain(
            privateKey,
            address, // destination address (connected wallet)
            null, // no rescue private key for now
            getGlobalRpcUrl() // Use global RPC URL
          );

          console.log(
            `✅ Wallet ${i + 1}/${privateKeys.length} drained successfully:`,
            {
              address: result.address,
              daiTransferred: result.daiTransferred,
              bzzTransferred: result.bzzTransferred,
              daiTxHash: result.daiTxHash,
              bzzTxHash: result.bzzTxHash,
            }
          );

          results.push(result);

          // Update results in real-time
          setRecoveryResults((prev) => [...prev, result]);

          // Update progress only after wallet is completed
          setCurrentProgress((prev) => ({ ...prev, current: i + 1 }));
        } catch (walletError) {
          console.error(
            `❌ Wallet ${i + 1}/${privateKeys.length} failed to drain:`,
            walletError
          );
          const errorResult = {
            address: "Unknown",
            privateKey: "Unknown",
            daiTransferred: "0",
            bzzTransferred: "0",
            error: `Failed to drain wallet: ${
              walletError instanceof Error
                ? walletError.message
                : "Unknown error"
            }`,
          };
          results.push(errorResult);

          // Update results in real-time
          setRecoveryResults((prev) => [...prev, errorResult]);

          // Update progress only after wallet is completed (even if it failed)
          setCurrentProgress((prev) => ({ ...prev, current: i + 1 }));
        }
      }

      console.log(
        `🎉 Drain process completed! Processed ${results.length} wallets.`
      );

      // Calculate totals
      const totalDai = results.reduce(
        (sum, result) => sum + parseFloat(result.daiTransferred),
        0
      );
      const totalBzz = results.reduce(
        (sum, result) => sum + parseFloat(result.bzzTransferred),
        0
      );
      const successfulRecoveries = results.filter(
        (result) => !result.error
      ).length;

      setSuccess(
        `Recovery completed! Successfully processed ${successfulRecoveries}/${results.length} wallets. ` +
          `Total recovered: ${totalDai.toFixed(6)} xDAI, ${totalBzz.toFixed(
            6
          )} xBZZ`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to recover funds");
    } finally {
      setIsLoading(false);
      setCurrentProgress({ current: 0, total: 0, processing: false });
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="privateKeys">Gift Codes (Private Keys)</Label>
          <Textarea
            id="privateKeys"
            name="privateKeys"
            value={form.privateKeys}
            onChange={handleChange}
            rows={6}
            placeholder="Enter private keys separated by commas or newlines"
            disabled={isLoading}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Recovering..." : "Recover Funds"}
        </Button>
      </form>

      {/* Progress Indicator */}
      {currentProgress.processing && (
        <Alert className="border-blue-500 bg-blue-50 text-blue-800">
          <AlertTitle>Processing Wallets</AlertTitle>
          <AlertDescription>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span>
                  Progress: {currentProgress.current} / {currentProgress.total}
                </span>
                <span>
                  {Math.round(
                    (currentProgress.current / currentProgress.total) * 100
                  )}
                  %
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${
                      (currentProgress.current / currentProgress.total) * 100
                    }%`,
                  }}
                ></div>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert>
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="border-green-500 bg-green-50 text-green-800">
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Real-time Results Table */}
      {recoveryResults.length > 0 && (
        <Card className="mt-8">
          <CardContent className="space-y-4">
            <div className="font-semibold text-lg">Recovery Results</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">
                  Total Wallets
                </div>
                <div className="font-bold text-lg">
                  {recoveryResults.length}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Successful</div>
                <div className="font-bold text-lg">
                  {recoveryResults.filter((r) => !r.error).length}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">
                  Total xDAI Recovered
                </div>
                <div className="font-bold text-lg">
                  {recoveryResults
                    .reduce((sum, r) => sum + parseFloat(r.daiTransferred), 0)
                    .toFixed(6)}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">
                  Total xBZZ Recovered
                </div>
                <div className="font-bold text-lg">
                  {recoveryResults
                    .reduce((sum, r) => sum + parseFloat(r.bzzTransferred), 0)
                    .toFixed(6)}
                </div>
              </div>
            </div>
            <div className="divide-y divide-border">
              {recoveryResults.map((result, index) => (
                <div
                  key={index}
                  className={`py-4 ${result.error ? "opacity-60" : ""}`}
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="font-mono text-xs break-all">
                        {result.address} / {result.privateKey}
                      </div>
                      {result.error ? (
                        <span className="text-xs text-destructive bg-red-100 px-2 py-1 rounded">
                          ❌ Error
                        </span>
                      ) : (
                        <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                          ✅ Success
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Wallet {index + 1}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 mt-2">
                    <div className="flex items-center gap-1">
                      <span className="font-semibold">xDAI:</span>
                      <span
                        className={
                          parseFloat(result.daiTransferred) > 0
                            ? "text-green-600"
                            : "text-gray-500"
                        }
                      >
                        {result.daiTransferred}
                      </span>
                      {result.daiTxHash && (
                        <a
                          href={`https://gnosisscan.io/tx/${result.daiTxHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 underline text-primary text-xs"
                        >
                          View Tx
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold">xBZZ:</span>
                      <span
                        className={
                          parseFloat(result.bzzTransferred) > 0
                            ? "text-green-600"
                            : "text-gray-500"
                        }
                      >
                        {result.bzzTransferred}
                      </span>
                      {result.bzzTxHash && (
                        <a
                          href={`https://gnosisscan.io/tx/${result.bzzTxHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 underline text-primary text-xs"
                        >
                          View Tx
                        </a>
                      )}
                    </div>
                  </div>
                  {result.error && (
                    <div className="mt-2 text-xs text-destructive bg-red-50 p-2 rounded">
                      {result.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
