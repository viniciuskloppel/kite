import { createKeyPairSignerFromBytes, generateKeyPairSigner, KeyPairSigner } from "@solana/web3.js";
import { assertKeyGenerationIsAvailable } from "@solana/assertions";
import { exportRawPrivateKeyBytes, exportRawPublicKeyBytes, getBase58AddressFromPublicKey } from "./crypto";
import {
  BASE58_CHARACTER_SET,
  DEFAULT_FILEPATH,
  GRIND_COMPLEXITY_THRESHOLD,
  KEYPAIR_LENGTH,
  KEYPAIR_PUBLIC_KEY_OFFSET,
} from "./constants";
const ALLOW_EXTRACTABLE_PRIVATE_KEY_MESSAGE =
  "yes I understand the risk of extractable private keys and will delete this keypair shortly after saving it to a file";

export const grindKeyPair = async (
  prefix: string | null = null,
  suffix: string | null = null,
  silenceGrindProgress: boolean = false,
  isPrivateKeyExtractable: false | typeof ALLOW_EXTRACTABLE_PRIVATE_KEY_MESSAGE = false,
): Promise<CryptoKeyPair> => {
  await assertKeyGenerationIsAvailable();

  // Do not allow extractable keyPairs unless the user has explicitly said they understand the risk
  const allowExtractablePrivateKey = isPrivateKeyExtractable === ALLOW_EXTRACTABLE_PRIVATE_KEY_MESSAGE;

  // Ensure the prefix and suffix are within the base58 character set
  if (prefix && !BASE58_CHARACTER_SET.test(prefix)) {
    throw new Error("Prefix must contain only base58 characters.");
  }
  if (suffix && !BASE58_CHARACTER_SET.test(suffix)) {
    throw new Error("Suffix must contain only base58 characters.");
  }

  // Add the total length of the prefix and suffix
  const keypairGrindComplexity = (prefix?.length || 0) + (suffix?.length || 0);
  // Throw a warning if keypairGrindComplexity is greater than GRIND_COMPLEXITY_THRESHOLD
  if (keypairGrindComplexity > GRIND_COMPLEXITY_THRESHOLD) {
    console.warn(
      `Generating a keyPair with a prefix and suffix of ${keypairGrindComplexity} characters, this may take some time.`,
    );
  }

  // Run a loop until we that starts with the prefix and ends with the suffix
  let counter = 0;
  while (true) {
    counter++;

    // Log every 100,000 iterations
    if (!silenceGrindProgress && counter % 100000 === 0) {
      console.log(`Keypair grind tries: ${counter}`);
    }

    const keyPair = await crypto.subtle.generateKey(
      "Ed25519", // Algorithm. Native implementation status: https://github.com/WICG/webcrypto-secure-curves/issues/20
      allowExtractablePrivateKey, // Allows the private key to be exported (eg for saving it to a file) - public key is always extractable see https://wicg.github.io/webcrypto-secure-curves/#ed25519-operations
      ["sign", "verify"], // Allowed uses
    );

    const publicKeyString = await getBase58AddressFromPublicKey(keyPair.publicKey);

    // If we don't have a prefix, we don't need to check if the keyPair starts with the prefix
    if (!prefix && !suffix) {
      return keyPair;
    }

    const matchesPrefix = prefix ? publicKeyString.startsWith(prefix) : true;
    const matchesSuffix = suffix ? publicKeyString.endsWith(suffix) : true;

    // If the keyPair matches, return it
    if (matchesPrefix && matchesSuffix) {
      return keyPair;
    }

    // Restart the loop
    continue;
  }
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
export const loadWalletFromFile = async (filepath?: string): Promise<KeyPairSigner> => {
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
export const loadWalletFromEnvironment = (variableName: string) => {
  const privateKeyString = process.env[variableName];
  if (!privateKeyString) {
    throw new Error(`Please set '${variableName}' in environment.`);
  }

  try {
    // If we wanted to, we could also support base58 encoded private keys
    // let decodedPrivateKey = getBase58Encoder().encode(solanaPrivateKeyBase58)
    // but the array-of-numbers format is the Anza CLI's format
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
