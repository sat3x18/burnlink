/**
 * BurnLink Cryptography Module
 * 
 * Implements end-to-end encryption using Web Crypto API
 * - AES-256-GCM for content encryption
 * - HKDF for key derivation
 * - Keys stored only in URL fragment (never sent to server)
 */

// Helper to get ArrayBuffer from Uint8Array - using slice creates a new ArrayBuffer
function toArrayBuffer(arr: Uint8Array): ArrayBuffer {
  // Using slice on the ArrayBuffer creates a true copy that is always ArrayBuffer type
  const buffer = arr.buffer;
  const copy = new ArrayBuffer(arr.byteLength);
  new Uint8Array(copy).set(arr);
  return copy;
}

// Generate a cryptographically secure random key
export async function generateKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

// Export key to base64url string for URL fragment
export async function exportKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('raw', key);
  return arrayBufferToBase64Url(exported);
}

// Import key from base64url string
export async function importKey(keyString: string): Promise<CryptoKey> {
  const keyBuffer = base64UrlToArrayBuffer(keyString);
  return await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

// Encrypt data with AES-256-GCM
export async function encrypt(
  data: string | ArrayBuffer,
  key: CryptoKey
): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> {
  const ivArray = new Uint8Array(12);
  crypto.getRandomValues(ivArray);
  
  let dataToEncrypt: ArrayBuffer;
  if (typeof data === 'string') {
    const encoded = new TextEncoder().encode(data);
    dataToEncrypt = toArrayBuffer(encoded);
  } else {
    dataToEncrypt = data;
  }
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: ivArray },
    key,
    dataToEncrypt
  );

  return { ciphertext, iv: ivArray };
}

// Decrypt data with AES-256-GCM
export async function decrypt(
  ciphertext: ArrayBuffer,
  key: CryptoKey,
  iv: Uint8Array
): Promise<ArrayBuffer> {
  // Convert iv to ensure it's a proper ArrayBuffer-backed Uint8Array
  const ivCopy = new Uint8Array(iv.length);
  ivCopy.set(iv);
  
  return await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivCopy },
    key,
    ciphertext
  );
}

// Decrypt to string
export async function decryptToString(
  ciphertext: ArrayBuffer,
  key: CryptoKey,
  iv: Uint8Array
): Promise<string> {
  const decrypted = await decrypt(ciphertext, key, iv);
  return new TextDecoder().decode(decrypted);
}

// Derive subkey using HKDF for different purposes
export async function deriveSubkey(
  masterKey: CryptoKey,
  purpose: 'message' | 'files' | 'chat' | 'receipts'
): Promise<CryptoKey> {
  const exportedKey = await crypto.subtle.exportKey('raw', masterKey);
  const baseKey = await crypto.subtle.importKey(
    'raw',
    exportedKey,
    { name: 'HKDF' },
    false,
    ['deriveKey']
  );

  const info = new TextEncoder().encode(`burnlink-${purpose}`);
  const salt = new TextEncoder().encode('burnlink-v1');

  return await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: toArrayBuffer(salt),
      info: toArrayBuffer(info),
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

// Password-based key derivation using PBKDF2
export async function deriveKeyFromPassword(
  password: string,
  salt?: Uint8Array
): Promise<{ key: CryptoKey; salt: Uint8Array }> {
  const usedSalt = salt || crypto.getRandomValues(new Uint8Array(16));
  
  const passwordEncoded = new TextEncoder().encode(password);
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(passwordEncoded),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(usedSalt),
      iterations: 100000,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  return { key, salt: usedSalt };
}

// Combine URL key with password-derived key
export async function combineKeys(
  urlKey: CryptoKey,
  passwordKey: CryptoKey
): Promise<CryptoKey> {
  const urlKeyBuffer = new Uint8Array(await crypto.subtle.exportKey('raw', urlKey));
  const passwordKeyBuffer = new Uint8Array(await crypto.subtle.exportKey('raw', passwordKey));
  
  const combined = new Uint8Array(urlKeyBuffer.byteLength + passwordKeyBuffer.byteLength);
  combined.set(urlKeyBuffer, 0);
  combined.set(passwordKeyBuffer, urlKeyBuffer.byteLength);
  
  const hash = await crypto.subtle.digest('SHA-256', toArrayBuffer(combined));
  
  return await crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

// Generate a cryptographically secure random ID
export function generateSecureId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return arrayBufferToBase64Url(toArrayBuffer(bytes));
}

// Utility functions
export function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export function base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(base64url.length + (4 - (base64url.length % 4)) % 4, '=');
  
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return toArrayBuffer(bytes);
}

// Combine IV and ciphertext for storage
export function packEncrypted(iv: Uint8Array, ciphertext: ArrayBuffer): string {
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return arrayBufferToBase64Url(toArrayBuffer(combined));
}

// Unpack IV and ciphertext from storage
export function unpackEncrypted(packed: string): { iv: Uint8Array; ciphertext: ArrayBuffer } {
  const combined = new Uint8Array(base64UrlToArrayBuffer(packed));
  const iv = combined.slice(0, 12);
  const ciphertext = toArrayBuffer(combined.slice(12));
  return { iv, ciphertext };
}
