import base58 from "bs58";
import {
  createKeyPairSignerFromBytes,
  generateKeyPair,
  generateKeyPairSigner,
  KeyPairSigner,
  signBytes,
  verifySignature,
} from "@solana/web3.js";
import { assertKeyGenerationIsAvailable } from "@solana/assertions";
import { exportRawPrivateKeyBytes, exportRawPublicKeyBytes } from "./crypto-utils";

// Anza keys concatenate the 32 bytes raw private key and the 32 bytes raw public key.
// This format was commonly used in NaCl / libsodium when they were popular.
export const KEYPAIR_LENGTH = 64;
export const KEYPAIR_PUBLIC_KEY_OFFSET = 32;

// Default value from Solana CLI
const DEFAULT_FILEPATH = "~/.config/solana/id.json";

export const generateExtractableKeyPair = async (): Promise<CryptoKeyPair> => {
  await assertKeyGenerationIsAvailable();
  const keyPair = await crypto.subtle.generateKey(
    /* algorithm */ "Ed25519", // Native implementation status: https://github.com/WICG/webcrypto-secure-curves/issues/20
    /* extractable */ true, //  Allows the private key to be exported (eg for saving it to a file)
    /* allowed uses */ ["sign", "verify"],
  );
  return keyPair;
};

// Take a webcrypto keyPair and convert it to the same format Anza CLI uses
// 32 bytes raw private key followed by 32 bytes raw public key
// (a bit odd, since the public key is usually derived from the private key, but
// this is how NaCl / libsodium did it, and it saves a little time not having
// to derive the public key from the private key)
export const createJSONFromKeyPairSigner = async (keyPairSigner: KeyPairSigner): Promise<string> => {
  const rawPrivateKeyBytes = await exportRawPrivateKeyBytes(keyPairSigner.keyPair.privateKey);
  const rawPublicKeyBytes = await exportRawPublicKeyBytes(keyPairSigner.keyPair.publicKey);

  // Concatenate the raw private and public keys
  const combinedArrayBuffer = new Uint8Array(KEYPAIR_LENGTH);
  combinedArrayBuffer.set(new Uint8Array(rawPrivateKeyBytes), 0);
  combinedArrayBuffer.set(new Uint8Array(rawPublicKeyBytes), KEYPAIR_PUBLIC_KEY_OFFSET);

  return JSON.stringify(Array.from(combinedArrayBuffer));
};

// From solana-web3.js/examples/transfer-lamports/src/example.ts
//  "These are the bytes that we saved at the time this account's key pair was originally
//  generated. Here, they are inlined into the source code, but you can also imagine them being
//  loaded from disk or, better yet, read from an environment variable."
// Oddly, Solana Foundation propose this be added to web3.js but were rejected.
export const getKeyPairSignerFromFile = async (filepath?: string): Promise<KeyPairSigner> => {
  // Node-specific imports
  const path = await import("node:path");
  const { readFile } = await import("node:fs/promises");
  // Work out correct file name
  if (!filepath) {
    filepath = DEFAULT_FILEPATH;
  }
  if (filepath[0] === "~") {
    const home = process.env.HOME || null;
    if (home) {
      filepath = path.join(home, filepath.slice(1));
    }
  }

  // Get contents of file
  let fileContents: string;
  try {
    const fileContentsBuffer = await readFile(filepath);
    fileContents = fileContentsBuffer.toString();
  } catch (thrownObject) {
    throw new Error(`Could not read keyPair from file at '${filepath}'`);
  }

  try {
    // Parse file and return the keyPair
    const parsedFileContents = Uint8Array.from(JSON.parse(fileContents));
    return createKeyPairSignerFromBytes(parsedFileContents);
  } catch (thrownObject) {
    const error = thrownObject as Error;
    if (!error.message.includes("Unexpected token")) {
      throw error;
    }
    throw new Error(`Invalid secret key file at '${filepath}'!`);
  }
};

// Get a keyPair based on an environment variable
// The keyPair is expected to be a JSON string of the raw bytes
// per what Anza CLI uses
// From solana-web3.js/examples/transfer-lamports/src/example.ts
//  "These are the bytes that we saved at the time this account's key pair was originally
//  generated. Here, they are inlined into the source code, but you can also imagine them being
//  loaded from disk or, better yet, read from an environment variable."
// Oddly, Solana Foundation propose this be added to web3.js but were rejected.
export const getKeyPairSignerFromEnvironment = (variableName: string) => {
  const privateKeyString = process.env[variableName];
  if (!privateKeyString) {
    throw new Error(`Please set '${variableName}' in environment.`);
  }

  try {
    let decodedPrivateKey = Uint8Array.from(JSON.parse(privateKeyString));
    return createKeyPairSignerFromBytes(decodedPrivateKey);
  } catch (error) {
    throw new Error(`Invalid private key in environment variable '${variableName}'!`);
  }
};

export const addKeyPairSignerToEnvFile = async (
  keyPairSigner: KeyPairSigner,
  variableName: string,
  envFileName?: string,
) => {
  // Node-specific imports
  const { appendFile } = await import("node:fs/promises");
  if (!envFileName) {
    envFileName = ".env";
  }
  const existingSecretKey = process.env[variableName];
  if (existingSecretKey) {
    throw new Error(`'${variableName}' already exists in env file.`);
  }
  const privateKeyString = await createJSONFromKeyPairSigner(keyPairSigner);
  await appendFile(envFileName, `\n# Solana Address: ${keyPairSigner.address}\n${variableName}=${privateKeyString}`);
};

// Shout out to Dean from WBA for this technique
export const makeKeyPairSigners = (amount: number): Promise<Array<KeyPairSigner>> => {
  // TODO: this should use initializeKeypairSigner()
  return Promise.all(Array.from({ length: amount }, () => generateKeyPairSigner()));
};
