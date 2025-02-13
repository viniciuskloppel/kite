import { lamports, address as toAddress } from "@solana/web3.js";

// Some program names
export const TOKEN_PROGRAM = toAddress("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const TOKEN_EXTENSIONS_PROGRAM = toAddress("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
export const ASSOCIATED_TOKEN_PROGRAM = toAddress("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

// Default values for making and loading wallets
export const SOL = 1_000_000_000n;
export const SECONDS = 1_000;
export const DEFAULT_AIRDROP_AMOUNT = lamports(1n * SOL);
export const DEFAULT_MINIMUM_BALANCE = lamports(500_000_000n);
export const DEFAULT_ENV_KEYPAIR_VARIABLE_NAME = "PRIVATE_KEY";

export const DEFAULT_TRANSACTION_RETRIES = 4;
export const DEFAULT_TRANSACTION_TIMEOUT = 15 * SECONDS;
// Anza keys concatenate the 32 bytes raw private key and the 32 bytes raw public key.
// This format was commonly used in NaCl / libsodium when they were popular.
export const KEYPAIR_LENGTH = 64;
export const KEYPAIR_PUBLIC_KEY_OFFSET = 32;

// Default value from Solana CLI
export const DEFAULT_FILEPATH = "~/.config/solana/id.json";

export const BASE58_CHARACTER_SET = /^[1-9A-HJ-NP-Za-km-z]+$/;

// 0x302e020100300506032b657004220420
// See https://stackoverflow.com/questions/79134901/how-can-i-make-a-webcrypto-cryptokeypair-from-a-uint8array
// TODO: add a better reference to a spec or ASN 1 decoding tool
const PKCS_8_PREFIX = new Uint8Array([48, 46, 2, 1, 0, 48, 5, 6, 3, 43, 101, 112, 4, 34, 4, 32]);
export const PKCS_8_PREFIX_LENGTH = PKCS_8_PREFIX.length;

export const GRIND_COMPLEXITY_THRESHOLD = 5;

// Make an object with a map of solana cluster names to subobjects, with the subobjects containing the URL and websocket URL
export const CLUSTERS: Record<
  string,
  {
    httpURL: string;
    webSocketURL: string;

    // The URL param name required for this cluster (eg for API keys)
    requiredParam: string | null;
    // The environment variable name used for requiredParam above.
    requiredParamEnvironmentVariable: string | null;

    features: {
      // Whether this is the default cluster for the Solana Explorer
      isExplorerDefault: boolean;
      // Whether this cluster name is known to the Solana Explorer
      isNameKnownToSolanaExplorer: boolean;
      // Whether this cluster supports Helius priority fee estimate instruction
      // See https://docs.helius.dev/solana-apis/priority-fee-api
      supportsGetPriorityFeeEstimate: boolean;
      // Enable retries on the client side
      enableClientSideRetries: boolean;
      // Whether this cluster needs priority fees
      needsPriorityFees: boolean;
    };
  }
> = {
  // Solana Labs RPCs
  // Don't add a seperate entry for 'mainnet'. Instead, we'll correct the cluster name to 'mainnet-beta'
  // in the connect function, and avoid making a duplicate entry.
  "mainnet-beta": {
    httpURL: "https://api.mainnet-beta.solana.com",
    webSocketURL: "wss://api.mainnet-beta.solana.com",
    requiredParam: null,
    requiredParamEnvironmentVariable: null,
    features: {
      isExplorerDefault: true,
      isNameKnownToSolanaExplorer: true,
      supportsGetPriorityFeeEstimate: false,
      enableClientSideRetries: true,
      needsPriorityFees: true,
    },
  },
  testnet: {
    httpURL: "https://api.testnet.solana.com",
    webSocketURL: "wss://api.testnet.solana.com",
    requiredParam: null,
    requiredParamEnvironmentVariable: null,
    features: {
      isExplorerDefault: false,
      isNameKnownToSolanaExplorer: true,
      supportsGetPriorityFeeEstimate: false,
      enableClientSideRetries: true,
      needsPriorityFees: true,
    },
  },
  devnet: {
    httpURL: "https://api.devnet.solana.com",
    webSocketURL: "wss://api.devnet.solana.com",
    requiredParam: null,
    requiredParamEnvironmentVariable: null,
    features: {
      isExplorerDefault: false,
      isNameKnownToSolanaExplorer: true,
      supportsGetPriorityFeeEstimate: false,
      enableClientSideRetries: true,
      needsPriorityFees: true,
    },
  },
  // Helius RPCs
  "helius-mainnet": {
    httpURL: "https://mainnet.helius-rpc.com/",
    webSocketURL: "wss://mainnet.helius-rpc.com/",
    requiredParam: "api-key",
    requiredParamEnvironmentVariable: "HELIUS_API_KEY",
    features: {
      isExplorerDefault: false,
      isNameKnownToSolanaExplorer: false,
      supportsGetPriorityFeeEstimate: true,
      enableClientSideRetries: true,
      needsPriorityFees: true,
    },
  },
  "helius-testnet": {
    httpURL: "https://testnet.helius-rpc.com/",
    webSocketURL: "wss://testnet.helius-rpc.com/",
    requiredParam: "api-key",
    requiredParamEnvironmentVariable: "HELIUS_API_KEY",
    features: {
      isExplorerDefault: false,
      isNameKnownToSolanaExplorer: false,
      supportsGetPriorityFeeEstimate: false,
      enableClientSideRetries: true,
      needsPriorityFees: true,
    },
  },
  "helius-devnet": {
    httpURL: "https://devnet.helius-rpc.com/",
    webSocketURL: "wss://devnet.helius-rpc.com/",
    requiredParam: "api-key",
    requiredParamEnvironmentVariable: "HELIUS_API_KEY",
    features: {
      isExplorerDefault: false,
      isNameKnownToSolanaExplorer: false,
      supportsGetPriorityFeeEstimate: false,
      enableClientSideRetries: true,
      needsPriorityFees: true,
    },
  },
  // Localnet
  localnet: {
    httpURL: "http://localhost:8899",
    webSocketURL: "ws://localhost:8900",
    requiredParam: null,
    requiredParamEnvironmentVariable: null,
    features: {
      isExplorerDefault: false,
      isNameKnownToSolanaExplorer: false,
      supportsGetPriorityFeeEstimate: false,
      enableClientSideRetries: false,
      needsPriorityFees: false,
    },
  },
};

export const KNOWN_CLUSTER_NAMES = Object.keys(CLUSTERS);
// For error messages
export const KNOWN_CLUSTER_NAMES_STRING = KNOWN_CLUSTER_NAMES.join(", ");
