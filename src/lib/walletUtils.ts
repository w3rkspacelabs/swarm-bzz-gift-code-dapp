import { ethers } from 'ethers';
import { CONFIG, ERC20_ABI } from '../config';

export interface WalletInfo {
    address: string;
    privateKey: string;
    mnemonic?: string;
}

export interface GiftWallet {
    address: string;
    privateKey: string;
    xdaiBalance: string;
    xbzzBalance: string;
}

/**
 * Generate a new random wallet
 */
export function generateWallet(): WalletInfo {
    const wallet = ethers.Wallet.createRandom();
    return {
        address: wallet.address,
        privateKey: wallet.privateKey,
        mnemonic: wallet.mnemonic?.phrase
    };
}

/**
 * Generate multiple wallets
 */
export function generateWallets(count: number): WalletInfo[] {
    if (count <= 0 || count > CONFIG.MAX_WALLETS_PER_GENERATION) {
        throw new Error(`Invalid wallet count. Must be between 1 and ${CONFIG.MAX_WALLETS_PER_GENERATION}`);
    }

    const wallets: WalletInfo[] = [];
    for (let i = 0; i < count; i++) {
        wallets.push(generateWallet());
    }
    return wallets;
}

/**
 * Import wallet from private key
 */
export function importWallet(privateKey: string): WalletInfo {
    try {
        const wallet = new ethers.Wallet(privateKey);
        return {
            address: wallet.address,
            privateKey: wallet.privateKey
        };
    } catch (error) {
        throw new Error('Invalid private key');
    }
}

/**
 * Parse private keys from text input
 * Accepts comma or newline separated values
 */
export function parsePrivateKeys(input: string): string[] {
    if (!input.trim()) {
        return [];
    }

    // Split by comma or newline and clean up
    const keys = input
        .split(/[,\n]/)
        .map(key => key.trim())
        .filter(key => key.length > 0);

    // Validate each key
    const validKeys: string[] = [];
    const invalidKeys: string[] = [];

    keys.forEach((key, index) => {
        try {
            // Check if it's a valid private key
            new ethers.Wallet(key);
            validKeys.push(key);
        } catch (error) {
            invalidKeys.push(`Key ${index + 1}: ${key.substring(0, 10)}...`);
        }
    });

    if (invalidKeys.length > 0) {
        throw new Error(`Invalid private keys found:\n${invalidKeys.join('\n')}`);
    }

    return validKeys;
}

/**
 * Validate private key format
 */
export function isValidPrivateKey(privateKey: string): boolean {
    try {
        new ethers.Wallet(privateKey);
        return true;
    } catch {
        return false;
    }
}

/**
 * Get wallet from private key with provider
 */
export function getWalletWithProvider(privateKey: string, rpcUrl: string): ethers.Wallet {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    return new ethers.Wallet(privateKey, provider);
}

/**
 * Get wallet balance in xDAI
 */
export async function getXDAIBalance(wallet: ethers.Wallet): Promise<string> {
    try {
        const balance = await wallet.provider?.getBalance(wallet.address);
        return ethers.formatEther(balance || 0);
    } catch (error) {
        console.error('Error getting xDAI balance:', error);
        return '0';
    }
}

/**
 * Get token balance
 */
export async function getTokenBalance(
    wallet: ethers.Wallet,
    tokenAddress: string
): Promise<string> {
    try {
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
        const balance = await tokenContract.balanceOf(wallet.address);
        const decimals = await tokenContract.decimals();
        return ethers.formatUnits(balance, decimals);
    } catch (error) {
        console.error('Error getting token balance:', error);
        return '0';
    }
}

/**
 * Transfer all xDAI from wallet to destination
 */
export async function transferAllXDAI(
    wallet: ethers.Wallet,
    destinationAddress: string
): Promise<ethers.TransactionResponse> {
    const balance = await wallet.provider?.getBalance(wallet.address);
    if (!balance || balance === 0n) {
        throw new Error('No xDAI balance to transfer');
    }

    // Estimate gas for the transfer
    const gasEstimate = await wallet.provider?.estimateGas({
        from: wallet.address,
        to: destinationAddress,
        value: balance
    });

    const gasPrice = await wallet.provider?.getFeeData();

    // Calculate gas cost
    const gasCost = (gasEstimate || 21000n) * (gasPrice?.gasPrice || 20000000000n);

    // Transfer amount minus gas cost
    const transferAmount = balance - gasCost;

    if (transferAmount <= 0n) {
        throw new Error('Insufficient balance to cover gas costs');
    }

    return wallet.sendTransaction({
        to: destinationAddress,
        value: transferAmount,
        gasLimit: gasEstimate
    });
}

/**
 * Transfer all tokens from wallet to destination
 */
export async function transferAllTokens(
    wallet: ethers.Wallet,
    tokenAddress: string,
    destinationAddress: string
): Promise<ethers.TransactionResponse> {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
    const balance = await tokenContract.balanceOf(wallet.address);

    if (balance === 0n) {
        throw new Error('No tokens to transfer');
    }

    return tokenContract.transfer(destinationAddress, balance);
}

/**
 * Get comprehensive wallet info including balances
 */
export async function getWalletInfo(
    privateKey: string,
    rpcUrl: string
): Promise<GiftWallet> {
    const wallet = getWalletWithProvider(privateKey, rpcUrl);

    const [xdaiBalance, xbzzBalance] = await Promise.all([
        getXDAIBalance(wallet),
        getTokenBalance(wallet, CONFIG.XBZZ_TOKEN_ADDRESS)
    ]);

    return {
        address: wallet.address,
        privateKey,
        xdaiBalance,
        xbzzBalance
    };
} 