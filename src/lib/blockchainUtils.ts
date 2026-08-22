import { CONFIG } from '@/config';
import { ethers } from 'ethers';

export function makeBzz(decimalString: string): string {
    return ethers.parseUnits(decimalString, CONFIG.BZZ_DECIMALS).toString();
}

export function makeDai(decimalString: string): string {
    return ethers.parseEther(decimalString).toString();
}

export async function privateKeyToAddress(privateKeyString: string): Promise<string> {
    const wallet = new ethers.Wallet(privateKeyString);
    return wallet.address;
}

const ABI = {
    uniswap: [
        {
            inputs: [
                {
                    internalType: 'uint256',
                    name: 'amountOutMin',
                    type: 'uint256'
                },
                {
                    internalType: 'address[]',
                    name: 'path',
                    type: 'address[]'
                },
                {
                    internalType: 'address',
                    name: 'to',
                    type: 'address'
                },
                {
                    internalType: 'uint256',
                    name: 'deadline',
                    type: 'uint256'
                }
            ],
            name: 'swapExactETHForTokens',
            outputs: [
                {
                    internalType: 'uint256[]',
                    name: 'amounts',
                    type: 'uint256[]'
                }
            ],
            stateMutability: 'payable',
            type: 'function'
        }
    ],
    bzz: [
        {
            type: 'function',
            stateMutability: 'nonpayable',
            payable: false,
            outputs: [
                {
                    type: 'bool',
                    name: ''
                }
            ],
            name: 'transfer',
            inputs: [
                {
                    type: 'address',
                    name: '_to'
                },
                {
                    type: 'uint256',
                    name: '_value'
                }
            ],
            constant: false
        },
        {
            constant: true,
            inputs: [
                {
                    name: '_owner',
                    type: 'address'
                }
            ],
            name: 'balanceOf',
            outputs: [
                {
                    name: 'balance',
                    type: 'uint256'
                }
            ],
            payable: false,
            type: 'function'
        }
    ]
} as const;

export async function swap(privateKey: string, value: string, minimumReturnValue: string, jsonRpcProvider: string) {
    const signer = await makeReadySigner(privateKey, jsonRpcProvider);
    const gasLimit = 29000000;
    const contract = new ethers.Contract(CONFIG.UNISWAP_ROUTER_V2_ADDRESS, ABI.uniswap, signer);

    const response = await contract.swapExactETHForTokens(
        minimumReturnValue,
        [CONFIG.XDAI_TOKEN_ADDRESS, CONFIG.XBZZ_TOKEN_ADDRESS],
        await signer.getAddress(),
        Date.now(),
        { value, gasLimit }
    );

    return response;
}

export interface DrainResult {
    address: string;
    privateKey: string;
    daiTransferred: string;
    bzzTransferred: string;
    daiTxHash?: string;
    bzzTxHash?: string;
    error?: string;
}

export async function drain(
    privateKey: string,
    to: string,
    rescuePrivateKey: string | null = null,
    jsonRpcProvider: string
): Promise<DrainResult> {
    const DAI_IGNORE_THRESHOLD = makeDai(String(CONFIG.MIN_XDAI_AMOUNT));
    const DAI_RESCUE_VALUE = makeDai(String(CONFIG.DAI_RESCUE_VALUE));
    const DAI_SAFE_SUB_VALUE = makeDai(String(CONFIG.DAI_SAFE_SUB_VALUE));

    const address = await privateKeyToAddress(privateKey);
    console.log(`🔍 Checking balances for wallet ${address}...`);

    let dai = await getNativeBalance(address, jsonRpcProvider);
    const bzz = await getBzzBalance(address, jsonRpcProvider);

    console.log(`💰 Wallet ${address} balances:`, {
        dai: ethers.formatEther(dai),
        bzz: ethers.formatUnits(bzz, CONFIG.BZZ_DECIMALS)
    });

    const result: DrainResult = {
        address,
        privateKey,
        daiTransferred: '0',
        bzzTransferred: '0'
    };

    try {
        // If DAI is below threshold and BZZ > 0, and rescue key provided, send rescue DAI
        if (ethers.getBigInt(dai) < ethers.getBigInt(DAI_IGNORE_THRESHOLD) &&
            ethers.getBigInt(bzz) > 0n &&
            rescuePrivateKey) {
            console.log(`🚨 Low DAI balance, sending rescue DAI to ${address}...`);
            await sendNativeTransaction(rescuePrivateKey, address, DAI_RESCUE_VALUE, jsonRpcProvider);
            dai = await getNativeBalance(address, jsonRpcProvider);
            console.log(`✅ Rescue DAI sent, new balance: ${ethers.formatEther(dai)}`);
        }

        // Transfer BZZ if balance > 0
        if (ethers.getBigInt(bzz) > 0n) {
            console.log(`🔄 Transferring ${ethers.formatUnits(bzz, CONFIG.BZZ_DECIMALS)} BZZ from ${address} to ${to}...`);
            const bzzTx = await sendBzzTransaction(privateKey, to, bzz, jsonRpcProvider);
            result.bzzTransferred = ethers.formatUnits(bzz, CONFIG.BZZ_DECIMALS);
            result.bzzTxHash = bzzTx.transaction.hash;
            console.log(`✅ BZZ transfer completed: ${result.bzzTxHash}`);
        } else {
            console.log(`ℹ️ No BZZ to transfer from ${address}`);
        }

        // Transfer DAI if balance > threshold
        if (ethers.getBigInt(dai) > ethers.getBigInt(DAI_IGNORE_THRESHOLD)) {
            const transferAmount = ethers.getBigInt(dai) - ethers.getBigInt(DAI_SAFE_SUB_VALUE);
            console.log(`🔄 Transferring ${ethers.formatEther(transferAmount)} DAI from ${address} to ${to}...`);
            const daiTx = await sendNativeTransaction(
                privateKey,
                to,
                transferAmount.toString(),
                jsonRpcProvider
            );
            result.daiTransferred = ethers.formatEther(transferAmount);
            result.daiTxHash = daiTx.transaction.hash;
            console.log(`✅ DAI transfer completed: ${result.daiTxHash}`);
        } else {
            console.log(`ℹ️ Insufficient DAI to transfer from ${address} (below threshold)`);
        }
    } catch (error) {
        console.error(`❌ Error draining wallet ${address}:`, error);
        result.error = error instanceof Error ? error.message : 'Unknown error during drain';
    }

    return result;
}

export async function getNativeBalance(address: string, jsonRpcProvider: string): Promise<string> {
    const provider = await makeReadyProvider(jsonRpcProvider);
    const bigNumberBalance = await provider.getBalance(address);
    return bigNumberBalance.toString();
}

export async function getBzzBalance(address: string, jsonRpcProvider: string): Promise<string> {
    const provider = await makeReadyProvider(jsonRpcProvider);
    const bzz = new ethers.Contract(CONFIG.XBZZ_TOKEN_ADDRESS, ABI.bzz, provider);
    const bigNumberBalance = await bzz.balanceOf(address);
    return bigNumberBalance.toString();
}

// export async function sendNativeTransaction(
//     privateKey: string,
//     to: string,
//     value: string,
//     jsonRpcProvider: string
// ) {
//     const signer = await makeReadySigner(privateKey, jsonRpcProvider);
//     const gasPrice = await signer.provider?.getFeeData();
//     const transaction = await signer.sendTransaction({
//         to,
//         value,
//         gasPrice: gasPrice?.gasPrice
//     });
//     const receipt = await transaction.wait(1);
//     return { transaction, receipt };
// }

// export async function sendBzzTransaction(
//     privateKey: string,
//     to: string,
//     value: string,
//     jsonRpcProvider: string
// ) {
//     const signer = await makeReadySigner(privateKey, jsonRpcProvider);
//     const gasPrice = await signer.provider?.getFeeData();
//     const bzz = new ethers.Contract('0xdBF3Ea6F5beE45c02255B2c26a16F300502F68da', ABI.bzz, signer);
//     const transaction = await bzz.transfer(to, value, { gasPrice: gasPrice?.gasPrice });
//     const receipt = await transaction.wait(1);
//     return { transaction, receipt };
// }

async function eip1559Fees(provider: ethers.Provider) {
    const fee = await provider.getFeeData();
    const latest = await provider.getBlock("latest");
    const base = latest?.baseFeePerGas ?? 0n;
    const tip = fee.maxPriorityFeePerGas ?? ethers.parseUnits("2", "gwei"); // ≥1 wei
    const max = fee.maxFeePerGas ?? (base * 2n + tip);
    return { maxFeePerGas: max, maxPriorityFeePerGas: tip };
}

export async function sendNativeTransaction(
    privateKey: string, to: string, valueEth: string, jsonRpcProvider: string
) {
    const provider = new ethers.JsonRpcProvider(jsonRpcProvider);
    const signer = new ethers.Wallet(privateKey, provider);
    const fees = await eip1559Fees(provider);
    console.log({ valueEth, valueEthP: ethers.parseEther(valueEth), valueEthB: BigInt(valueEth) })

    const txReq = {
        to,
        value: BigInt(valueEth),
        type: 2,
        ...fees
    };

    const gasLimit = await provider.estimateGas({ from: await signer.getAddress(), ...txReq });
    const tx = await signer.sendTransaction({ ...txReq, gasLimit });
    const receipt = await tx.wait(1);
    return { transaction: tx, receipt };
}

export async function sendBzzTransaction(
    privateKey: string, to: string, valueWei: string, jsonRpcProvider: string
) {
    const provider = new ethers.JsonRpcProvider(jsonRpcProvider);
    const signer = new ethers.Wallet(privateKey, provider);
    const fees = await eip1559Fees(provider);

    const bzz = new ethers.Contract(
        CONFIG.XBZZ_TOKEN_ADDRESS,
        ABI.bzz,
        signer
    );

    const gasLimit = await bzz.transfer.estimateGas(to, valueWei, { type: 2, ...fees });
    const tx = await bzz.transfer(to, valueWei, { type: 2, gasLimit, ...fees });
    const receipt = await tx.wait(1);
    return { transaction: tx, receipt };
}

async function makeReadySigner(privateKey: string, jsonRpcProvider: string): Promise<ethers.Wallet> {
    const provider = new ethers.JsonRpcProvider(jsonRpcProvider, 100);
    await provider.ready;
    const signer = new ethers.Wallet(privateKey, provider);
    return signer;
}

async function makeReadyProvider(jsonRpcProvider: string): Promise<ethers.JsonRpcProvider> {
    const provider = new ethers.JsonRpcProvider(jsonRpcProvider, 100);
    await provider.ready;
    return provider;
} 