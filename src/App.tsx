import { useState, useEffect } from 'react';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { gnosis } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { GenerateCodes } from './pages/GenerateCodes';
import { RecoverFunds } from './pages/RecoverFunds';
import { WalletBalanceCard } from './components/WalletBalanceCard';
import { APP_NAME, APP_TAGLINE } from './config';
import './index.css';

const config = createConfig({
  chains: [gnosis],
  transports: {
    [gnosis.id]: http(),
  },
});

// Create QueryClient with proper configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      retry: false,
    },
  },
});

export default function App() {
  const [tab, setTab] = useState('generate');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold mb-2">{APP_NAME}</div>
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <div className="min-h-screen bg-background text-foreground">
            <header className="container py-6 flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold">{APP_NAME}</h1>
                <p className="text-muted-foreground">{APP_TAGLINE}</p>
              </div>
              <ConnectButton />
            </header>
            <main className="container py-8">
              <WalletBalanceCard />
              <Tabs value={tab} onValueChange={setTab} className="w-full">
                <div className="flex justify-center mb-6">
                  <TabsList>
                    <TabsTrigger value="generate">Generate Codes</TabsTrigger>
                    <TabsTrigger value="recover">Recover Funds</TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="generate">
                  <Card className="max-w-2xl mx-auto">
                    <CardContent className="p-6">
                      <GenerateCodes />
                    </CardContent>
                  </Card>
                </TabsContent>
                <TabsContent value="recover">
                  <Card className="max-w-2xl mx-auto">
                    <CardContent className="p-6">
                      <RecoverFunds />
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </main>
            <footer className="container py-6 text-center text-xs text-muted-foreground">
              Built with React, TypeScript, Vite, RainbowKit, wagmi, ethers.js, and shadcn/ui
            </footer>
          </div>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
