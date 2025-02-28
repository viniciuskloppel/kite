import { Commitment, generateKeyPairSigner, Lamports, some } from "@solana/web3.js";

import { Address } from "@solana/web3.js";

import {
  // This is badly named. It's a function that returns an object.
  extension as getExtensionData,
  findAssociatedTokenPda,
  getCreateAssociatedTokenInstructionAsync,
  getInitializeMetadataPointerInstruction,
  getInitializeMintInstruction,
  getInitializeTokenMetadataInstruction,
  getMintSize,
  getMintToInstruction,
  getUpdateTokenMetadataFieldInstruction,
  TOKEN_2022_PROGRAM_ADDRESS,
  tokenMetadataField,
  getTransferCheckedInstruction,
  fetchMint,
  getCreateAssociatedTokenInstruction,
} from "@solana-program/token-2022";
import { createSolanaRpcFromTransport, KeyPairSigner } from "@solana/web3.js";
import { sendTransactionFromInstructionsFactory } from "./transactions";
import { getCreateAccountInstruction, getTransferSolInstruction } from "@solana-program/system";
import { TOKEN_PROGRAM } from "./constants";
import { TOKEN_EXTENSIONS_PROGRAM } from "./constants";

export const transferLamportsFactory = (
  sendTransactionFromInstructions: ReturnType<typeof sendTransactionFromInstructionsFactory>,
) => {
  const transferLamports = async ({
    source,
    destination,
    amount,
    skipPreflight = true,
    maximumClientSideRetries = 0,
    abortSignal = null,
  }: {
    source: KeyPairSigner;
    destination: Address;
    amount: Lamports;
    skipPreflight?: boolean;
    maximumClientSideRetries?: number;
    abortSignal?: AbortSignal | null;
  }) => {
    const instruction = getTransferSolInstruction({
      amount,
      destination: destination,
      source: source,
    });

    const signature = await sendTransactionFromInstructions({
      feePayer: source,
      instructions: [instruction],
      commitment: "confirmed",
      skipPreflight,
      maximumClientSideRetries,
      abortSignal,
    });

    return signature;
  };
  return transferLamports;
};

export const transferTokensFactory = (
  getMint: ReturnType<typeof getMintFactory>,
  sendTransactionFromInstructions: ReturnType<typeof sendTransactionFromInstructionsFactory>,
) => {
  /**
   * Transfers tokens from one account to another. The sender must sign the transaction.
   * @param {Object} params - The transfer parameters
   * @param {KeyPairSigner} params.sender - Signer that owns the tokens and will sign the transaction
   * @param {Address} params.destination - Address to receive the tokens
   * @param {Address} params.mintAddress - Address of the token mint
   * @param {bigint} params.amount - Amount of tokens to transfer (in base units)
   * @param {number} [params.maximumClientSideRetries=0] - Maximum number of times to retry sending the transaction
   * @param {AbortSignal | null} [params.abortSignal=null] - Signal to abort the transaction
   * @returns {Promise<string>} Transaction signature
   */
  const transferTokens = async ({
    sender,
    destination,
    mintAddress,
    amount,
    maximumClientSideRetries = 0,
    abortSignal = null,
  }: {
    sender: KeyPairSigner;
    destination: Address;
    mintAddress: Address;
    amount: bigint;
    maximumClientSideRetries?: number;
    abortSignal?: AbortSignal | null;
  }) => {
    const mint = await getMint(mintAddress);

    if (!mint) {
      throw new Error(`Mint not found: ${mintAddress}`);
    }

    const decimals = mint.data.decimals;

    const sourceAssociatedTokenAddress = await getTokenAccountAddress(sender.address, mintAddress, true);

    const destinationAssociatedTokenAddress = await getTokenAccountAddress(destination, mintAddress, true);

    // Create an associated token account for the receiver
    const createAssociatedTokenInstruction = getCreateAssociatedTokenInstruction({
      ata: destinationAssociatedTokenAddress,
      mint: mintAddress,
      owner: destination,
      payer: sender,
    });

    const transferInstruction = getTransferCheckedInstruction({
      source: sourceAssociatedTokenAddress,
      mint: mintAddress,
      destination: destinationAssociatedTokenAddress,
      authority: sender.address,
      amount,
      decimals,
    });

    const signature = await sendTransactionFromInstructions({
      feePayer: sender,
      instructions: [createAssociatedTokenInstruction, transferInstruction],
      commitment: "confirmed",
      skipPreflight: true,
      maximumClientSideRetries,
      abortSignal,
    });

    return signature;
  };
  return transferTokens;
};

/**
 * Gets the associated token account address for a given wallet and token mint.
 * @param {Address} wallet - The wallet address to get the token account for
 * @param {Address} mint - The token mint address
 * @param {boolean} [useTokenExtensions=false] - Whether to use Token Extensions program
 * @returns {Promise<Address>} The associated token account address
 */
export const getTokenAccountAddress = async (wallet: Address, mint: Address, useTokenExtensions: boolean = false) => {
  const tokenProgram = useTokenExtensions ? TOKEN_EXTENSIONS_PROGRAM : TOKEN_PROGRAM;

  // Slightly misnamed, it returns an address and a seed
  const [address] = await findAssociatedTokenPda({
    mint: mint,
    owner: wallet,
    tokenProgram,
  });

  return address;
};

export const createTokenMintFactory = (
  rpc: ReturnType<typeof createSolanaRpcFromTransport>,
  sendTransactionFromInstructions: ReturnType<typeof sendTransactionFromInstructionsFactory>,
) => {
  /**
   * Creates a new SPL token mint with specified parameters and metadata.
   * @param {Object} params - The token mint parameters
   * @param {KeyPairSigner} params.mintAuthority - Authority that can mint new tokens
   * @param {number} params.decimals - Number of decimal places for the token
   * @param {string} params.name - Name of the token
   * @param {string} params.symbol - Symbol of the token
   * @param {string} params.uri - URI pointing to the token's metadata
   * @param {Record<string, string> | Map<string, string>} [params.additionalMetadata={}] - Additional metadata fields
   * @returns {Promise<Address>} The address of the new token mint
   */
  const createTokenMint = async ({
    mintAuthority,
    decimals,
    name,
    symbol,
    uri,
    additionalMetadata = {},
  }: {
    mintAuthority: KeyPairSigner;
    decimals: number;
    name: string;
    symbol: string;
    uri: string;
    additionalMetadata?: Record<string, string> | Map<string, string>;
  }) => {
    // See https://solana.stackexchange.com/questions/19747/how-do-i-make-a-token-with-metadata-using-web3-js-version-2/19792#19792 - big thanks to John for helping me turn the unit tests into a working example

    // Generate keypairs for and mint
    const mint = await generateKeyPairSigner();

    // Convert additionalMetadata to a Map if it's a Record
    const additionalMetadataMap =
      additionalMetadata instanceof Map ? additionalMetadata : new Map(Object.entries(additionalMetadata));

    // Metadata Pointer Extension Data
    // Storing metadata directly in the mint account
    const metadataPointerExtensionData = getExtensionData("MetadataPointer", {
      authority: some(mintAuthority.address),
      metadataAddress: some(mint.address),
    });

    // Token Metadata Extension Data
    // Using this to calculate rent lamports up front
    const tokenMetadataExtensionData = getExtensionData("TokenMetadata", {
      updateAuthority: some(mintAuthority.address),
      mint: mint.address,
      name,
      symbol,
      uri,
      additionalMetadata: additionalMetadataMap,
    });

    // The amount of space required to initialize the mint account (with metadata pointer extension only)
    // Excluding the metadata extension intentionally
    // The metadata extension instruction MUST come after initialize mint instruction,
    // Including space for the metadata extension will result in
    // error: "invalid account data for instruction" when the initialize mint instruction is processed
    const spaceWithoutMetadata = BigInt(getMintSize([metadataPointerExtensionData]));

    // The amount of space required for the mint account and both extensions
    // Use to calculate total rent lamports that must be allocated to the mint account
    // The metadata extension instruction automatically does the space reallocation,
    // but DOES NOT transfer the rent lamports required to store the extra metadata
    const spaceWithMetadata = BigInt(getMintSize([metadataPointerExtensionData, tokenMetadataExtensionData]));

    // Calculate rent lamports for mint account with metadata pointer and token metadata extensions
    const rent = await rpc.getMinimumBalanceForRentExemption(spaceWithMetadata).send();

    // Instruction to create new account for mint (token 2022 program)
    // space: only for mint and metadata pointer extension, other wise initialize instruction will fail
    // lamports: for mint, metadata pointer extension, and token metadata extension (paying up front for simplicity)
    const createAccountInstruction = getCreateAccountInstruction({
      payer: mintAuthority,
      newAccount: mint,
      lamports: rent,
      space: spaceWithoutMetadata,
      programAddress: TOKEN_2022_PROGRAM_ADDRESS,
    });

    // Instruction to initialize metadata pointer extension
    // This instruction must come before initialize mint instruction
    const initializeMetadataPointerInstruction = getInitializeMetadataPointerInstruction({
      mint: mint.address,
      authority: mintAuthority.address,
      metadataAddress: mint.address,
    });

    // Instruction to initialize base mint account data
    const initializeMintInstruction = getInitializeMintInstruction({
      mint: mint.address,
      decimals,
      mintAuthority: mintAuthority.address,
    });

    // Instruction to initialize token metadata extension
    // This instruction must come after initialize mint instruction
    // This ONLY initializes basic metadata fields (name, symbol, uri)
    const initializeTokenMetadataInstruction = getInitializeTokenMetadataInstruction({
      metadata: mint.address,
      updateAuthority: mintAuthority.address,
      mint: mint.address,
      mintAuthority: mintAuthority,
      name: tokenMetadataExtensionData.name,
      symbol: tokenMetadataExtensionData.symbol,
      uri: tokenMetadataExtensionData.uri,
    });

    // Instruction to update token metadata extension
    // This either updates existing fields or adds the custom additionalMetadata fields
    const updateTokenMetadataInstruction = getUpdateTokenMetadataFieldInstruction({
      metadata: mint.address,
      updateAuthority: mintAuthority,
      field: tokenMetadataField("Key", ["description"]),
      value: "Only Possible On Solana",
    });

    // Order of instructions to add to transaction
    const instructions = [
      createAccountInstruction,
      initializeMetadataPointerInstruction,
      initializeMintInstruction,
      initializeTokenMetadataInstruction,
      updateTokenMetadataInstruction,
    ];

    await sendTransactionFromInstructions({
      feePayer: mintAuthority,
      instructions,
    });

    return mint.address;
  };

  return createTokenMint;
};

export const mintTokensFactory = (
  sendTransactionFromInstructions: ReturnType<typeof sendTransactionFromInstructionsFactory>,
) => {
  /**
   * Mints tokens from a token mint to a destination account. The mint authority must sign the transaction.
   * @param {Address} mintAddress - Address of the token mint
   * @param {KeyPairSigner} mintAuthority - Signer with authority to mint tokens
   * @param {bigint} amount - Amount of tokens to mint (in base units)
   * @param {Address} destination - Address to receive the minted tokens
   * @returns {Promise<string>} Transaction signature
   */
  const mintTokens = async (
    mintAddress: Address,
    mintAuthority: KeyPairSigner,
    amount: bigint,
    destination: Address,
  ) => {
    // Create Associated Token Account
    const createAtaInstruction = await getCreateAssociatedTokenInstructionAsync({
      payer: mintAuthority,
      mint: mintAddress,
      owner: destination,
    });

    // Derive destination associated token address
    // Instruction to mint tokens to associated token account
    const associatedTokenAddress = await getTokenAccountAddress(destination, mintAddress, true);

    const mintToInstruction = getMintToInstruction({
      mint: mintAddress,
      token: associatedTokenAddress,
      mintAuthority: mintAuthority.address,
      amount: amount,
    });

    const transactionSignature = await sendTransactionFromInstructions({
      feePayer: mintAuthority,
      instructions: [createAtaInstruction, mintToInstruction],
    });

    return transactionSignature;
  };
  return mintTokens;
};

export const getMintFactory = (rpc: ReturnType<typeof createSolanaRpcFromTransport>) => {
  /**
   * Gets information about a token mint, including its decimals, authority, and supply.
   * @param {Address} mintAddress - Address of the token mint to get information for
   * @param {Commitment} [commitment="confirmed"] - Desired confirmation level
   * @returns {Promise<Mint | null>} Information about the token mint, or null if not found
   */
  const getMint = async (mintAddress: Address, commitment: Commitment = "confirmed") => {
    const mint = await fetchMint(rpc, mintAddress, { commitment });
    return mint;
  };

  return getMint;
};

export const getTokenAccountBalanceFactory = (rpc: ReturnType<typeof createSolanaRpcFromTransport>) => {
  /**
   * Gets the balance of tokens in a token account for a given wallet and mint.
   * @param {Address} wallet - The wallet address to check the token balance for
   * @param {Address} mint - The token mint address
   * @param {boolean} [useTokenExtensions=false] - Whether to use Token Extensions program
   * @returns {Promise<TokenAmount>} The token balance information including amount and decimals
   */
  const getTokenAccountBalance = async (wallet: Address, mint: Address, useTokenExtensions: boolean = false) => {
    const tokenAccountAddress = await getTokenAccountAddress(wallet, mint, useTokenExtensions);
    const result = await rpc.getTokenAccountBalance(tokenAccountAddress).send();
    return result.value;
  };
  return getTokenAccountBalance;
};
