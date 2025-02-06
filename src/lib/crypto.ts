// 0x302e020100300506032b657004220420
// See https://stackoverflow.com/questions/79134901/how-can-i-make-a-webcrypto-cryptokeypair-from-a-uint8array
// TODO: add a better reference to a spec or ASN 1 decoding tool
const PKCS_8_PREFIX = new Uint8Array([48, 46, 2, 1, 0, 48, 5, 6, 3, 43, 101, 112, 4, 34, 4, 32]);

export const PKCS_8_PREFIX_LENGTH = PKCS_8_PREFIX.length;

// Fixes "Value of "this" must be of type SubtleCrypto" errors
const exportKey = crypto.subtle.exportKey.bind(crypto.subtle);

// Annoyingly we can't directly output the "raw" value of a private key
// (we have to use another format)
// See https://wicg.github.io/webcrypto-secure-curves/#ed25519-operations
// So let's strip out the PKCS8 prefix and return the raw bytes that follow
export const exportRawPrivateKeyBytes = async (privateKey: CryptoKey): Promise<Uint8Array> => {
  if (!privateKey.extractable) {
    throw new Error("Private key is not extractable");
  }
  const pkcs8Bytes = await crypto.subtle.exportKey("pkcs8", privateKey);
  const rawPrivateKeyBytes = pkcs8Bytes.slice(PKCS_8_PREFIX_LENGTH);
  return new Uint8Array(rawPrivateKeyBytes);
};

export const exportRawPublicKeyBytes = async (publicKey: CryptoKey): Promise<Uint8Array> => {
  // We can export the public key directly as "raw" thank god.
  if (!publicKey.extractable) {
    throw new Error("Public key is not extractable");
  }
  const rawPublicKeyBytes = await exportKey("raw", publicKey);
  return new Uint8Array(rawPublicKeyBytes);
};
