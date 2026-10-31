type EncryptedRecord = {
  id: string;
  userId: string;
  iv: string;
  ciphertext: string;
  updatedAt: number;
};

type StoredKey = { userId: string; key: CryptoKey };
type EncryptedOutboxRecord = EncryptedRecord & { idempotencyKey: string; createdAt: number };

export type PendingOfflineTransaction = {
  id: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  createdAt: number;
};

const DATABASE_NAME = "mwecau-guider-private-offline";
const DATABASE_VERSION = 3;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = (event) => {
      const database = request.result;
      const transaction = request.transaction;
      if (!database.objectStoreNames.contains("keys")) {
        database.createObjectStore("keys", { keyPath: "userId" });
      }
      if (!database.objectStoreNames.contains("snapshots")) {
        const snapshots = database.createObjectStore("snapshots", { keyPath: "id" });
        snapshots.createIndex("userId", "userId", { unique: false });
      }
      if (!database.objectStoreNames.contains("outbox")) {
        const outbox = database.createObjectStore("outbox", { keyPath: "id" });
        outbox.createIndex("userId", "userId", { unique: false });
      }
      if (event.oldVersion < 3 && !database.objectStoreNames.contains("outboxKeys")) {
        const outboxKeys = database.createObjectStore("outboxKeys", { keyPath: "userId" });
        // Preserve decryptability of transactions queued by database versions 1–2.
        // Copy existing non-extractable CryptoKeys inside the version-change transaction.
        const cursorRequest = transaction?.objectStore("keys").openCursor();
        if (cursorRequest) {
          cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result;
            if (!cursor) return;
            outboxKeys.put(cursor.value);
            cursor.continue();
          };
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open offline storage."));
  });
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Offline storage request failed."));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("Offline storage transaction aborted."));
    transaction.onerror = () => reject(transaction.error ?? new Error("Offline storage transaction failed."));
  });
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function getOrCreateUserKey(database: IDBDatabase, userId: string, storeName: "keys" | "outboxKeys" = "keys"): Promise<CryptoKey> {
  const existing = await requestValue<StoredKey | undefined>(
    database.transaction(storeName, "readonly").objectStore(storeName).get(userId)
  );
  if (existing) return existing.key;

  const generated = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );

  try {
    const transaction = database.transaction(storeName, "readwrite");
    const completed = transactionDone(transaction);
    transaction.objectStore(storeName).add({ userId, key: generated } satisfies StoredKey);
    await completed;
    return generated;
  } catch {
    const winner = await requestValue<StoredKey | undefined>(
      database.transaction(storeName, "readonly").objectStore(storeName).get(userId)
    );
    if (winner) return winner.key;
    throw new Error("Unable to create the private offline encryption key.");
  }
}

async function encryptValue(key: CryptoKey, value: unknown): Promise<{ iv: string; ciphertext: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return { iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(encrypted)) };
}

async function decryptValue<T>(key: CryptoKey, record: EncryptedRecord): Promise<T> {
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(record.iv) },
    key,
    fromBase64(record.ciphertext)
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}

function normalizeUserId(userId: string | number): string {
  const normalized = String(userId).trim();
  if (!normalized) throw new Error("A valid account ID is required for offline storage.");
  return normalized;
}

export async function saveOfflineSnapshot(userId: string | number, resource: string, value: unknown): Promise<void> {
  const accountId = normalizeUserId(userId);
  if (!resource.trim()) throw new Error("A snapshot resource name is required.");
  const database = await openDatabase();
  try {
    const key = await getOrCreateUserKey(database, accountId);
    const encrypted = await encryptValue(key, value);
    const record: EncryptedRecord = { id: `${accountId}:${resource}`, userId: accountId, ...encrypted, updatedAt: Date.now() };
    const transaction = database.transaction("snapshots", "readwrite");
    const completed = transactionDone(transaction);
    transaction.objectStore("snapshots").put(record);
    await completed;
  } finally {
    database.close();
  }
}

export async function readOfflineSnapshot<T>(userId: string | number, resource: string): Promise<T | null> {
  const accountId = normalizeUserId(userId);
  const database = await openDatabase();
  try {
    const record = await requestValue<EncryptedRecord | undefined>(
      database.transaction("snapshots", "readonly").objectStore("snapshots").get(`${accountId}:${resource}`)
    );
    if (!record) return null;
    const storedKey = await requestValue<StoredKey | undefined>(
      database.transaction("keys", "readonly").objectStore("keys").get(accountId)
    );
    if (!storedKey) return null;
    return await decryptValue<T>(storedKey.key, record);
  } finally {
    database.close();
  }
}

/**
 * Revoke access to cached private snapshots on logout/session expiry without
 * deleting user-created pending transactions. The outbox has its own key so
 * queued writes remain encrypted and recoverable after the next sign-in.
 */
export async function clearUserOfflineData(userId: string | number): Promise<void> {
  const accountId = normalizeUserId(userId);
  const database = await openDatabase();
  try {
    const transaction = database.transaction(["keys", "snapshots"], "readwrite");
    const completed = transactionDone(transaction);
    transaction.objectStore("keys").delete(accountId);
    const snapshots = transaction.objectStore("snapshots");
    const request = snapshots.index("userId").openCursor(IDBKeyRange.only(accountId));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      cursor.delete();
      cursor.continue();
    };
    await completed;
  } finally {
    database.close();
  }
}

export async function enqueueOfflineTransaction(userId: string | number, idempotencyKey: string, payload: Record<string, unknown>): Promise<void> {
  const accountId = normalizeUserId(userId);
  if (idempotencyKey.length < 16 || idempotencyKey.length > 128) {
    throw new Error("A valid idempotency key is required for the offline transaction queue.");
  }
  const database = await openDatabase();
  try {
    const id = accountId + ":" + idempotencyKey;
    const outbox = database.transaction("outbox", "readonly").objectStore("outbox");
    const existingRecords = await requestValue<EncryptedOutboxRecord[]>(outbox.getAll());
    const existing = existingRecords.find((record) => record.id === id && record.userId === accountId);
    const key = await getOrCreateUserKey(database, accountId, "outboxKeys");
    if (existing) {
      const previous = await decryptValue<Record<string, unknown>>(key, existing);
      if (JSON.stringify(previous) !== JSON.stringify(payload)) {
        throw new Error("This offline transaction key is already assigned to a different payload.");
      }
      return;
    }
    const encrypted = await encryptValue(key, payload);
    const record: EncryptedOutboxRecord = { id, userId: accountId, idempotencyKey, ...encrypted, createdAt: Date.now(), updatedAt: Date.now() };
    const transaction = database.transaction("outbox", "readwrite");
    const completed = transactionDone(transaction);
    transaction.objectStore("outbox").add(record);
    await completed;
  } finally {
    database.close();
  }
}

export async function listPendingOfflineTransactions(userId: string | number): Promise<PendingOfflineTransaction[]> {
  const accountId = normalizeUserId(userId);
  const database = await openDatabase();
  try {
    const allRecords = await requestValue<EncryptedOutboxRecord[]>(
      database.transaction("outbox", "readonly").objectStore("outbox").getAll()
    );
    const records = allRecords.filter((record) => record.userId === accountId);
    if (records.length === 0) return [];
    const storedKey = await requestValue<StoredKey | undefined>(
      database.transaction("outboxKeys", "readonly").objectStore("outboxKeys").get(accountId)
    );
    if (!storedKey) return [];
    return await Promise.all(records.map(async (record) => ({
      id: record.id,
      idempotencyKey: record.idempotencyKey,
      payload: await decryptValue<Record<string, unknown>>(storedKey.key, record),
      createdAt: record.createdAt
    })));
  } finally {
    database.close();
  }
}

export async function removeOfflineTransaction(userId: string | number, id: string): Promise<void> {
  const accountId = normalizeUserId(userId);
  const database = await openDatabase();
  try {
    const transaction = database.transaction("outbox", "readwrite");
    const completed = transactionDone(transaction);
    const store = transaction.objectStore("outbox");
    const request = store.get(id);
    request.onsuccess = () => {
      const record = request.result as EncryptedOutboxRecord | undefined;
      if (record?.userId === accountId) store.delete(id);
    };
    await completed;
  } finally {
    database.close();
  }
}
