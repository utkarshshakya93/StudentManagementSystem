// Frontend Client-Side Cryptographic Module
// Salt generation, Salted Hashing (SHA-256), and Salted AES-GCM Cipher Encoding/Decoding

const PEPPER_HASH = "sms_academic_sec_2026";
const PEPPER_CIPHER = "sms_pepper_key_2026";

/**
 * Generate cryptographically secure 16-byte random salt in hex
 */
export function generateSalt() {
  const array = new Uint8Array(16);
  window.crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash password with salt using SHA-256 via Web Crypto API
 */
export async function hashPasswordWithSalt(password, salt) {
  const enc = new TextEncoder();
  const data = enc.encode(`${salt}:${password}:${PEPPER_HASH}`);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Derive AES-GCM 256-bit CryptoKey using PBKDF2 from salt + pepper
 */
async function deriveAesKey(salt) {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(`${salt}:${PEPPER_CIPHER}`),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations: 10000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encode/Encrypt password with salt using AES-GCM
 * Returns { salt, passwordHash, passwordCipher, iv }
 */
export async function secureSaltPassword(password, existingSalt = null) {
  const salt = existingSalt || generateSalt();
  const passwordHash = await hashPasswordWithSalt(password, salt);

  const enc = new TextEncoder();
  const aesKey = await deriveAesKey(salt);

  const ivArray = new Uint8Array(12);
  window.crypto.getRandomValues(ivArray);
  const iv = Array.from(ivArray, b => b.toString(16).padStart(2, '0')).join('');

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: ivArray },
    aesKey,
    enc.encode(password)
  );

  const encryptedArray = Array.from(new Uint8Array(encryptedBuffer));
  const passwordCipher = encryptedArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return {
    salt,
    passwordHash,
    passwordCipher,
    iv
  };
}

/**
 * Decode/Decrypt password on frontend side using algorithm and stored salt + IV
 */
export async function decodePasswordWithSalt(passwordCipherHex, salt, ivHex) {
  if (!passwordCipherHex || !salt || !ivHex) return null;
  try {
    const aesKey = await deriveAesKey(salt);

    const ivBytes = new Uint8Array(ivHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    const cipherBytes = new Uint8Array(passwordCipherHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes },
      aesKey,
      cipherBytes
    );

    const dec = new TextDecoder();
    return dec.decode(decryptedBuffer);
  } catch (err) {
    console.warn("Failed to decode password on frontend:", err.message);
    return null;
  }
}

/**
 * Verify entered password against stored salt, hash, and cipher
 */
export async function verifyPasswordCredentials(enteredPassword, salt, storedHash, storedCipher = null, storedIv = null) {
  if (!enteredPassword || !salt) return false;

  // 1. Salted Hash Comparison
  if (storedHash) {
    const computedHash = await hashPasswordWithSalt(enteredPassword, salt);
    if (computedHash === storedHash) {
      return true;
    }
  }

  // 2. Decode on frontend comparison
  if (storedCipher && storedIv) {
    const decoded = await decodePasswordWithSalt(storedCipher, salt, storedIv);
    if (decoded && decoded === enteredPassword) {
      return true;
    }
  }

  return false;
}
