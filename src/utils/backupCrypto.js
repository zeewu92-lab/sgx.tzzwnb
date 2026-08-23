import { BACKUP_FILE_MAGIC, BACKUP_KEY_MATERIAL } from '../constants/backupConstants';

let backupCryptoKeyPromise = null;

function getBackupCryptoKey() {
  if (!backupCryptoKeyPromise) {
    backupCryptoKeyPromise = (async () => {
      const rawKey = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(BACKUP_KEY_MATERIAL)
      );

      return crypto.subtle.importKey(
        'raw',
        rawKey,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
      );
    })();
  }

  return backupCryptoKeyPromise;
}

function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

export async function encryptBackupText(jsonText) {
  const key = await getBackupCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(jsonText)
  );

  const combined = new Uint8Array(iv.length + cipherBuf.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuf), iv.length);

  return BACKUP_FILE_MAGIC + bytesToBase64(combined);
}

export async function decryptBackupText(fileText) {
  const combined = base64ToBytes(
    fileText.slice(BACKUP_FILE_MAGIC.length)
  );

  const iv = combined.slice(0, 12);
  const cipherBytes = combined.slice(12);

  const key = await getBackupCryptoKey();

  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    cipherBytes
  );

  return new TextDecoder().decode(plainBuf);
}

export async function parseBackupPayload(fileText) {
  try {
    if (
      typeof fileText !== 'string' ||
      !fileText.startsWith(BACKUP_FILE_MAGIC)
    ) {
      return null;
    }

    const jsonText = await decryptBackupText(fileText);
    const data = JSON.parse(jsonText);

    if (
      !data ||
      typeof data !== 'object' ||
      (!Array.isArray(data.clocks) && !Array.isArray(data.events))
    ) {
      return null;
    }

    return data;
  } catch (err) {
    return null;
  }
}
