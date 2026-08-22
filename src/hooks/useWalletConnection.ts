import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useState, useEffect } from 'react';
import { CONFIG } from '../config';

export function useWalletConnection() {
    const [mounted, setMounted] = useState(false);
    const { address, isConnected, isConnecting, chainId } = useAccount();
    const { connectors } = useConnect();
    const { disconnect } = useDisconnect();

    useEffect(() => {
        setMounted(true);
    }, []);

    const isCorrectNetwork = mounted && chainId === CONFIG.CHAIN_ID;

    const connectWallet = () => {
        // Wallet connection is handled by RainbowKit ConnectButton
        // This function can be used for custom connection logic if needed
    };

    const switchToGnosisChain = () => {
        // In wagmi v2, network switching is handled by the wallet
        // The user needs to manually switch to Gnosis Chain
    };

    const disconnectWallet = () => {
        disconnect();
    };

    return {
        // Wallet state
        address,
        isConnected,
        isConnecting,
        isCorrectNetwork,

        // Chain info
        chainId,

        // Actions
        connectWallet,
        disconnectWallet,
        switchToGnosisChain,

        // Available connectors
        connectors
    };
} 