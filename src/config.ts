// Configuration constants for the Swarm BZZ Gift Code Dapp

export const APP_NAME = 'Swarm BZZ Gift Code Dapp';
export const APP_TAGLINE = 'Generate and recover Swarm BZZ gift wallets on Gnosis Chain';

export const CONFIG = {
    // Gnosis Chain configuration
    CHAIN_ID: 100,
    CHAIN_NAME: 'Gnosis Chain',

    // Contract addresses
    FUND_CONTRACT_ADDRESS: '0xf268827Ef03CCCBEcf1d305b5B7DeD50D5ea4298',

    // Token addresses on Gnosis Chain
    XDAI_TOKEN_ADDRESS: '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d', // xDAI
    XBZZ_TOKEN_ADDRESS: '0xdBF3Ea6F5beE45c02255B2c26a16F300502F68da', // xBZZ
    UNISWAP_ROUTER_V2_ADDRESS: '0x1C232F01118CB8B424793ae03F870aa7D0ac7f77',

    // Default RPC URL (can be overridden by user)
    DEFAULT_RPC_URL: 'https://rpc.gnosischain.com',

    DEFAULT_XDAI_AMOUNT: 0.1,
    DEFAULT_XBZZ_AMOUNT: 1,
    DEFAULT_WALLET_COUNT: 1,

    BZZ_DECIMALS: 16,

    // Gas settings
    GAS_LIMIT: 300000,
    GAS_PRICE: '20000000000', // 20 gwei

    // QR Code settings
    QR_CODE_SIZE: 200,
    QR_CODE_MARGIN: 2,

    // UI settings
    MAX_WALLETS_PER_GENERATION: 100,
    MIN_XDAI_AMOUNT: 0.01,
    MIN_XBZZ_AMOUNT: 0,
    DAI_RESCUE_VALUE: 0.1,
    DAI_SAFE_SUB_VALUE: 0.008,
} as const;

// Fund contract ABI for the fund function
export const FUND_CONTRACT_ABI = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "token",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "tokenAmount",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "nativeAmount",
                "type": "uint256"
            },
            {
                "internalType": "address[]",
                "name": "addresses",
                "type": "address[]"
            }
        ],
        "name": "fund",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    }
] as const;

// ERC20 token ABI for balance and transfer functions
export const ERC20_ABI = [
    {
        "constant": true,
        "inputs": [{ "name": "_owner", "type": "address" }],
        "name": "balanceOf",
        "outputs": [{ "name": "balance", "type": "uint256" }],
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [
            { "name": "_to", "type": "address" },
            { "name": "_value", "type": "uint256" }
        ],
        "name": "transfer",
        "outputs": [{ "name": "", "type": "bool" }],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "decimals",
        "outputs": [{ "name": "", "type": "uint8" }],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "symbol",
        "outputs": [{ "name": "", "type": "string" }],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [
            { "name": "_owner", "type": "address" },
            { "name": "_spender", "type": "address" }
        ],
        "name": "allowance",
        "outputs": [{ "name": "", "type": "uint256" }],
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [
            { "name": "_spender", "type": "address" },
            { "name": "_value", "type": "uint256" }
        ],
        "name": "approve",
        "outputs": [{ "name": "", "type": "bool" }],
        "type": "function"
    }
] as const;
