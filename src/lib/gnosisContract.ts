import { ethers } from 'ethers';
import { CONFIG, FUND_CONTRACT_ABI, ERC20_ABI } from '../config';
import { getBzzBalance, getNativeBalance } from './blockchainUtils';

export interface FundParams {
    tokenAddress: string;
    tokenAmount: bigint; // Amount per wallet
    nativeAmount: bigint; // Amount per wallet
    addresses: string[];
}

/**
 * Get contract instance with provider
 */
export function getFundContract(rpcUrl: string): ethers.Contract {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    return new ethers.Contract(CONFIG.FUND_CONTRACT_ADDRESS, FUND_CONTRACT_ABI, provider);
}

/**
 * Get contract instance with signer
 */
export function getFundContractWithSigner(signer: ethers.Signer): ethers.Contract {
    return new ethers.Contract(CONFIG.FUND_CONTRACT_ADDRESS, FUND_CONTRACT_ABI, signer);
}

/**
 * Fund multiple wallets with tokens and native currency using signer
 */
export async function fundWalletsWithSigner(
    signer: ethers.Signer,
    params: FundParams
): Promise<ethers.TransactionResponse> {
    const contract = getFundContractWithSigner(signer);

    // Calculate total native amount needed for msg.value
    const totalNativeAmount = params.nativeAmount * BigInt(params.addresses.length);
    const totalTokenAmount = params.tokenAmount * BigInt(params.addresses.length);

    console.log({
        tokenAddress: params.tokenAddress,
        tokenAmount: params.tokenAmount, // per-wallet amount
        nativeAmount: params.nativeAmount, // per-wallet amount
        totalNativeAmount, // total for msg.value
        totalTokenAmount, // total tokens needed
        addresses: params.addresses,
    });

    // Check if we have sufficient token allowance
    const currentAllowance = await checkTokenAllowance(signer, params.tokenAddress, CONFIG.FUND_CONTRACT_ADDRESS);
    console.log('Current allowance:', currentAllowance.toString());
    console.log('Required allowance:', totalTokenAmount.toString());

    if (currentAllowance < totalTokenAmount) {
        console.log('Insufficient allowance, approving tokens...');
        const approveTx = await approveTokens(signer, params.tokenAddress, CONFIG.FUND_CONTRACT_ADDRESS, totalTokenAmount);
        console.log('Approval transaction hash:', approveTx.hash);

        // Wait for approval transaction to be confirmed
        const approveReceipt = await approveTx.wait();
        console.log('Approval confirmed in block:', approveReceipt?.blockNumber);
    }

    // Estimate gas for the transaction
    // Contract expects: fund(token, tokenAmountPerWallet, nativeAmountPerWallet, addresses)
    // Contract validates: addresses.length * nativeAmountPerWallet == msg.value
    const gasEstimate = await contract.fund.estimateGas(
        params.tokenAddress,
        params.tokenAmount, // per-wallet amount
        params.nativeAmount, // per-wallet amount
        params.addresses,
        { value: totalNativeAmount }
    );

    console.log('gasEstimate', gasEstimate);

    // throw new Error('test');

    // Execute the fund transaction
    return contract.fund(
        params.tokenAddress,
        params.tokenAmount, // per-wallet amount
        params.nativeAmount, // per-wallet amount
        params.addresses,
        {
            value: totalNativeAmount, // total amount for msg.value
            gasLimit: gasEstimate
        }
    );
}

/**
 * Fund multiple wallets with tokens and native currency (legacy function with private key)
 */
export async function fundWallets(
    privateKey: string,
    rpcUrl: string,
    params: FundParams
): Promise<ethers.TransactionResponse> {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(CONFIG.FUND_CONTRACT_ADDRESS, FUND_CONTRACT_ABI, wallet);

    // Calculate total native amount needed for msg.value
    const totalNativeAmount = params.nativeAmount * BigInt(params.addresses.length);

    console.log('fundWallets', {
        tokenAddress: params.tokenAddress,
        tokenAmount: params.tokenAmount, // per-wallet amount
        nativeAmount: params.nativeAmount, // per-wallet amount
        totalNativeAmount, // total for msg.value
        addresses: params.addresses,
    });

    // Estimate gas for the transaction
    // Contract expects: fund(token, tokenAmountPerWallet, nativeAmountPerWallet, addresses)
    // Contract validates: addresses.length * nativeAmountPerWallet == msg.value
    const gasEstimate = await contract.fund.estimateGas(
        params.tokenAddress,
        params.tokenAmount, // per-wallet amount
        params.nativeAmount, // per-wallet amount
        params.addresses,
        { value: totalNativeAmount }
    );

    console.log('gasEstimate', gasEstimate);

    // Execute the fund transaction
    /*
    function fund(
        ERC20 token,
        uint256 tokenAmount,
        uint256 nativeAmount,
        address payable[] calldata addresses
    ) public payable {
        require(
            addresses.length * nativeAmount == msg.value,
            "incorrect msg.value amount"
        );
    */
    return contract.fund(
        params.tokenAddress,
        params.tokenAmount, // per-wallet amount
        params.nativeAmount, // per-wallet amount
        params.addresses,
        {
            value: totalNativeAmount, // total amount for msg.value
            gasLimit: gasEstimate
        }
    );
}

/**
 * Validate fund parameters
 */
export function validateFundParams(params: FundParams): string[] {
    const errors: string[] = [];

    if (!ethers.isAddress(params.tokenAddress)) {
        errors.push('Invalid token address');
    }

    if (params.tokenAmount <= 0n) {
        errors.push('Token amount must be greater than 0');
    }

    if (params.nativeAmount <= 0n) {
        errors.push('Native amount must be greater than 0');
    }

    if (params.addresses.length === 0) {
        errors.push('At least one address is required');
    }

    // Validate all addresses
    params.addresses.forEach((address, index) => {
        if (!ethers.isAddress(address)) {
            errors.push(`Invalid address at index ${index}: ${address}`);
        }
    });

    return errors;
}

/**
 * Calculate total cost for funding wallets
 */
export function calculateTotalCost(
    xdaiPerWallet: number,
    xbzzPerWallet: number,
    walletCount: number
): {
    totalXDai: bigint;
    totalXBzz: bigint;
    totalCostInWei: bigint;
} {
    console.log('calculateTotalCost', { xdaiPerWallet, xbzzPerWallet, walletCount });
    const xdaiPerWalletWei = ethers.parseEther(xdaiPerWallet.toString());
    const xbzzPerWalletWei = ethers.parseUnits(xbzzPerWallet.toString(), 16); // BZZ has 16 decimals

    const totalXDai = xdaiPerWalletWei * BigInt(walletCount);
    const totalXBzz = xbzzPerWalletWei * BigInt(walletCount);
    const totalCostInWei = totalXDai; // Only xDAI is sent as native currency
    console.log('calculateTotalCost', { totalXDai, totalXBzz, totalCostInWei });
    return {
        totalXDai,
        totalXBzz,
        totalCostInWei
    };
}

/**
 * Get xBZZ balance for connected wallet
 */
export async function getXBZZBalanceWithSigner(
    signer: ethers.Signer
): Promise<string> {
    const address = await signer.getAddress();
    const provider = signer.provider;

    if (!provider) {
        throw new Error('No provider available');
    }

    try {
        // Use the existing getBzzBalance function with the provider's RPC URL
        const rpcUrl = (provider as any).connection?.url || CONFIG.DEFAULT_RPC_URL;
        const balanceWei = await getBzzBalance(address, rpcUrl);
        // Convert from wei to human readable format (BZZ has 16 decimals)
        return ethers.formatUnits(balanceWei, 16);
    } catch (error) {
        console.error('Error getting xBZZ balance:', error);
        return '0';
    }
}

/**
 * Check if wallet has sufficient balance for funding using signer
 */
export async function checkFundingBalanceWithSigner(
    signer: ethers.Signer,
    xdaiPerWallet: number,
    xbzzPerWallet: number,
    walletCount: number
): Promise<{
    hasSufficientBalance: boolean;
    currentBalance: bigint;
    requiredBalance: bigint;
    shortfall: bigint;
    xbzzBalance: bigint;
    xbzzRequired: bigint;
    xbzzShortfall: bigint;
    hasSufficientXBZZ: boolean;
}> {
    const address = await signer.getAddress();
    const provider = signer.provider;

    if (!provider) {
        throw new Error('No provider available');
    }

    // Use existing functions for balance checking
    const rpcUrl = (provider as any).connection?.url || CONFIG.DEFAULT_RPC_URL;
    const [currentBalanceWei, xbzzBalanceStr] = await Promise.all([
        getNativeBalance(address, rpcUrl),
        getXBZZBalanceWithSigner(signer)
    ]);

    const currentBalance = ethers.getBigInt(currentBalanceWei);
    const { totalCostInWei, totalXBzz } = calculateTotalCost(xdaiPerWallet, xbzzPerWallet, walletCount);
    const xbzzBalanceWei = ethers.parseUnits(xbzzBalanceStr, 16); // BZZ has 16 decimals

    const hasSufficientBalance = currentBalance >= totalCostInWei;
    const hasSufficientXBZZ = xbzzBalanceWei >= totalXBzz;
    const shortfall = hasSufficientBalance ? 0n : totalCostInWei - currentBalance;
    const xbzzShortfall = hasSufficientXBZZ ? 0n : totalXBzz - xbzzBalanceWei;

    return {
        hasSufficientBalance,
        currentBalance,
        requiredBalance: totalCostInWei,
        shortfall,
        xbzzBalance: xbzzBalanceWei,
        xbzzRequired: totalXBzz,
        xbzzShortfall,
        hasSufficientXBZZ
    };
}

/**
 * Check token allowance for the fund contract
 */
export async function checkTokenAllowance(
    signer: ethers.Signer,
    tokenAddress: string,
    spenderAddress: string
): Promise<bigint> {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
    const ownerAddress = await signer.getAddress();
    return await tokenContract.allowance(ownerAddress, spenderAddress);
}

/**
 * Approve tokens for the fund contract
 */
export async function approveTokens(
    signer: ethers.Signer,
    tokenAddress: string,
    spenderAddress: string,
    amount: bigint
): Promise<ethers.TransactionResponse> {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
    return await tokenContract.approve(spenderAddress, amount);
}

/**
 * Check if wallet has sufficient balance for funding (legacy function with private key)
 */
export async function checkFundingBalance(
    privateKey: string,
    rpcUrl: string,
    xdaiPerWallet: number,
    xbzzPerWallet: number,
    walletCount: number
): Promise<{
    hasSufficientBalance: boolean;
    currentBalance: bigint;
    requiredBalance: bigint;
    shortfall: bigint;
}> {
    const wallet = new ethers.Wallet(privateKey, new ethers.JsonRpcProvider(rpcUrl));
    const currentBalance = await wallet.provider?.getBalance(wallet.address) || 0n;

    const { totalCostInWei } = calculateTotalCost(xdaiPerWallet, xbzzPerWallet, walletCount);

    const hasSufficientBalance = currentBalance >= totalCostInWei;
    const shortfall = hasSufficientBalance ? 0n : totalCostInWei - currentBalance;

    return {
        hasSufficientBalance,
        currentBalance,
        requiredBalance: totalCostInWei,
        shortfall
    };
} 