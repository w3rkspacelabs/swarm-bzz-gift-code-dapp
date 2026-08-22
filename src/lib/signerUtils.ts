import { ethers } from 'ethers';
import { CONFIG } from '../config';

/**
 * Get the connected wallet's signer for contract interactions
 */
export async function getConnectedWalletSigner(): Promise<ethers.Signer | null> {
    if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error('No wallet detected');
    }

    try {
        // Request account access
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (!accounts || accounts.length === 0) {
            throw new Error('No accounts found');
        }

        // Create provider and signer
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();

        return signer;
    } catch (error) {
        console.error('Failed to get wallet signer:', error);
        throw new Error('Failed to connect to wallet. Please ensure your wallet is connected.');
    }
}

/**
 * Get the connected wallet's address
 */
export async function getConnectedWalletAddress(): Promise<string | null> {
    if (typeof window === 'undefined' || !window.ethereum) {
        return null;
    }

    try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        return accounts?.[0] || null;
    } catch (error) {
        console.error('Failed to get wallet address:', error);
        return null;
    }
}

/**
 * Check if the connected wallet is on the correct network
 */
export async function isOnCorrectNetwork(): Promise<boolean> {
    if (typeof window === 'undefined' || !window.ethereum) {
        return false;
    }

    try {
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        return chainId === `0x${CONFIG.CHAIN_ID.toString(16)}`;
    } catch (error) {
        console.error('Failed to check network:', error);
        return false;
    }
} 