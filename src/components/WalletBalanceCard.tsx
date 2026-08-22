import { useState, useEffect } from 'react';
import { useWalletConnection } from '../hooks/useWalletConnection';
import { getNativeBalance, getBzzBalance } from '../lib/blockchainUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ethers } from 'ethers';
import { CONFIG } from '@/config';

interface WalletBalance {
  xdai: string;
  xbzz: string;
  isLoading: boolean;
  error: string | null;
}

// Global RPC URL state
let globalRpcUrl: string = CONFIG.DEFAULT_RPC_URL;

// Export function to get global RPC URL
export function getGlobalRpcUrl(): string {
  return globalRpcUrl;
}

export function WalletBalanceCard() {
  const { address, isConnected, isCorrectNetwork } = useWalletConnection();
  const [rpcUrl, setRpcUrl] = useState<string>(CONFIG.DEFAULT_RPC_URL);
  const [balance, setBalance] = useState<WalletBalance>({
    xdai: '0',
    xbzz: '0',
    isLoading: false,
    error: null
  });

  useEffect(() => {
    if (!isConnected || !isCorrectNetwork || !address) {
      setBalance({
        xdai: '0',
        xbzz: '0',
        isLoading: false,
        error: null
      });
      return;
    }

    const fetchBalance = async () => {
      setBalance(prev => ({ ...prev, isLoading: true, error: null }));
      
      try {
        const [xdaiBalance, xbzzBalance] = await Promise.all([
          getNativeBalance(address, rpcUrl),
          getBzzBalance(address, rpcUrl)
        ]);

        setBalance({
          xdai: ethers.formatEther(xdaiBalance),
          xbzz: ethers.formatUnits(xbzzBalance, CONFIG.BZZ_DECIMALS),
          isLoading: false,
          error: null
        });
      } catch (error) {
        console.error('Failed to fetch wallet balance:', error);
        setBalance(prev => ({
          ...prev,
          isLoading: false,
          error: 'Failed to fetch wallet balance'
        }));
      }
    };

    // Fetch balance immediately
    fetchBalance();

    // Set up interval to refresh balance every 30 seconds
    const intervalId = setInterval(fetchBalance, 30000);

    return () => clearInterval(intervalId);
  }, [address, isConnected, isCorrectNetwork]);

  if (!isConnected) {
    return null;
  }

  if (!isCorrectNetwork) {
    return (
      <Card className="mb-6">
        <CardContent className="p-4">
          <Alert>
            <AlertTitle>Wrong Network</AlertTitle>
            <AlertDescription>
              Please switch to Gnosis Chain to view your wallet balance.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Connected Wallet Balance</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">        
        {balance.error ? (
          <Alert>
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{balance.error}</AlertDescription>
          </Alert>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="text-sm font-medium text-muted-foreground">xDAI Balance</div>
              <div className="text-2xl font-bold">
                {balance.isLoading ? '...' : `${parseFloat(balance.xdai).toFixed(6)} xDAI`}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium text-muted-foreground">xBZZ Balance</div>
              <div className="text-2xl font-bold">
                {balance.isLoading ? '...' : `${parseFloat(balance.xbzz).toFixed(6)} xBZZ`}
              </div>
            </div>
            <div className="col-span-2 text-xs text-muted-foreground">
              Wallet: {address?.slice(0, 6)}...{address?.slice(-4)}
            </div>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="rpcUrl">Gnosis RPC URL</Label>
          <Input
            id="rpcUrl"
            name="rpcUrl"
            type="url"
            value={rpcUrl}
            onChange={(e) => {
              setRpcUrl(e.target.value);
              globalRpcUrl = e.target.value;
            }}
            placeholder={CONFIG.DEFAULT_RPC_URL}
            className="text-sm"
          />
        </div>
      </CardContent>
    </Card>
  );
} 