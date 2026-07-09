/**
 * Browser-native End-to-End Encryption (E2EE) helper engine
 * Powered by Web Crypto API (SubtleCrypto)
 * Standard Hybrid Cryptosystem: RSA-OAEP + AES-GCM
 */

// Helper to convert Uint8Array bytes to Base64
function bytesToBase64(bytes: Uint8Array): string {
  const binString = Array.from(bytes, (x) => String.fromCharCode(x)).join("");
  return btoa(binString);
}

// Helper to convert Base64 string to Uint8Array bytes
function base64ToBytes(base64: string): Uint8Array {
  const binString = atob(base64);
  return Uint8Array.from(binString, (m) => m.charCodeAt(0));
}

export interface E2EEKeyPairStrings {
  publicKeyJwk: string;
  privateKeyJwk: string;
}

/**
 * Generate a new RSA-OAEP 2048-bit keypair for E2EE chat messaging
 */
export async function generateE2EEKeyPair(): Promise<E2EEKeyPairStrings> {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true, // extractable
    ["encrypt", "decrypt"]
  );

  const publicKeyJwk = await window.crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const privateKeyJwk = await window.crypto.subtle.exportKey("jwk", keyPair.privateKey);

  return {
    publicKeyJwk: JSON.stringify(publicKeyJwk),
    privateKeyJwk: JSON.stringify(privateKeyJwk),
  };
}

/**
 * Encrypt a text message using hybrid encryption:
 * 1. Generate an ephemeral AES-GCM symmetric key (256-bit).
 * 2. Encrypt the plaintext message with the AES key.
 * 3. Encrypt (wrap) the AES key with both the recipient's & sender's RSA Public Keys.
 */
export async function encryptE2EEMessage(
  plainText: string,
  recipientPublicKeyJwkStr: string,
  senderPublicKeyJwkStr: string
): Promise<{ encryptedText: string; encryptedKey: string; senderEncryptedKey: string }> {
  // 1. Generate Ephemeral AES Key
  const aesKey = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  // 2. Encrypt message body using AES-GCM
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(plainText);
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit standard IV

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    dataBytes
  );

  // Combine IV and Ciphertext before encoding
  const ciphertextBytes = new Uint8Array(ciphertextBuffer);
  const combinedBytes = new Uint8Array(iv.length + ciphertextBytes.length);
  combinedBytes.set(iv, 0);
  combinedBytes.set(ciphertextBytes, iv.length);
  
  const encryptedTextMessage = bytesToBase64(combinedBytes);

  // 3. Export AES key to raw bytes
  const aesRawKeyBytes = await window.crypto.subtle.exportKey("raw", aesKey);

  // 4. Encrypt the AES key for the recipient
  const recipientPubKey = await window.crypto.subtle.importKey(
    "jwk",
    JSON.parse(recipientPublicKeyJwkStr),
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );

  const recipientEncryptedBuffer = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    recipientPubKey,
    aesRawKeyBytes
  );
  const encryptedKeyRecipient = bytesToBase64(new Uint8Array(recipientEncryptedBuffer));

  // 5. Encrypt the AES key for the sender (history recovery)
  const senderPubKey = await window.crypto.subtle.importKey(
    "jwk",
    JSON.parse(senderPublicKeyJwkStr),
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );

  const senderEncryptedBuffer = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    senderPubKey,
    aesRawKeyBytes
  );
  const encryptedKeySender = bytesToBase64(new Uint8Array(senderEncryptedBuffer));

  return {
    encryptedText: encryptedTextMessage,
    encryptedKey: encryptedKeyRecipient,
    senderEncryptedKey: encryptedKeySender,
  };
}

/**
 * Decrypt a message:
 * 1. Import local RSA Private Key.
 * 2. Decrypt the wrapped AES-GCM key.
 * 3. Import the uncovered AES-GCM key.
 * 4. Decrypt the ciphertext message.
 */
export async function decryptE2EEMessage(
  encryptedTextBase64: string,
  encryptedKeyBase64: string,
  localPrivateKeyJwkStr: string
): Promise<string> {
  try {
    // 1. Recover RSA private key
    const privateKey = await window.crypto.subtle.importKey(
      "jwk",
      JSON.parse(localPrivateKeyJwkStr),
      { name: "RSA-OAEP", hash: "SHA-256" },
      true,
      ["decrypt"]
    );

    // 2. Decrypt wrapped AES key bytes
    const encryptedKeyBytes = base64ToBytes(encryptedKeyBase64);
    const aesKeyRawBuffer = await window.crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      privateKey,
      encryptedKeyBytes
    );

    // 3. Import AES key
    const aesKey = await window.crypto.subtle.importKey(
      "raw",
      aesKeyRawBuffer,
      { name: "AES-GCM" },
      true,
      ["decrypt"]
    );

    // 4. Parse combined message payload (12-byte IV + ciphertext)
    const combinedBytes = base64ToBytes(encryptedTextBase64);
    if (combinedBytes.length <= 12) {
      throw new Error("Invalid cipher size, too small.");
    }
    const iv = combinedBytes.slice(0, 12);
    const ciphertext = combinedBytes.slice(12);

    // 5. Decrypt message plaintext
    const plainTextBuffer = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      aesKey,
      ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(plainTextBuffer);
  } catch (err) {
    console.warn("E2EE decrypt failed", err);
    return "[Encrypted Message - Private Key Missing/Unmatched]";
  }
}
