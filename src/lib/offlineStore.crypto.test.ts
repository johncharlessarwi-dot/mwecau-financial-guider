import { webcrypto } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  enqueueOfflineTransaction,
  listPendingOfflineTransactions,
  readOfflineSnapshot,
  saveOfflineSnapshot
} from "./offlineStore";

const DATABASE_NAME = "mwecau-guider-private-offline";

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

describe("offline storage with real Web Crypto", () => {
  beforeEach(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DATABASE_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("Offline test database is blocked."));
    });
    vi.stubGlobal("crypto", webcrypto as unknown as Crypto);
  });

  it("persists non-extractable AES-GCM keys and ciphertext rather than plaintext", async () => {
    const privateSnapshot = {
      balance: "98500.00",
      accountLabel: "Private emergency savings",
      note: "Sensitive offline financial snapshot"
    };
    const privateTransaction = {
      amount: "12500.00",
      description: "Confidential offline purchase"
    };

    await saveOfflineSnapshot(771, "dashboard", privateSnapshot);
    await enqueueOfflineTransaction(771, "offline-crypto-key-0001", privateTransaction);

    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, 3);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    try {
      const transaction = database.transaction(["keys", "outboxKeys", "snapshots", "outbox"], "readonly");
      const [snapshotKey, outboxKey, snapshots, outbox] = await Promise.all([
        requestValue<{ userId: string; key: CryptoKey } | undefined>(transaction.objectStore("keys").get("771")),
        requestValue<{ userId: string; key: CryptoKey } | undefined>(transaction.objectStore("outboxKeys").get("771")),
        requestValue<Array<{ ciphertext: string; iv: string; userId: string }>>(transaction.objectStore("snapshots").getAll()),
        requestValue<Array<{ ciphertext: string; iv: string; userId: string }>>(transaction.objectStore("outbox").getAll())
      ]);

      expect(snapshotKey?.key.extractable).toBe(false);
      expect(outboxKey?.key.extractable).toBe(false);
      expect(snapshotKey?.key.algorithm.name).toBe("AES-GCM");
      expect(outboxKey?.key.algorithm.name).toBe("AES-GCM");
      expect(snapshotKey?.key).not.toBe(outboxKey?.key);
      expect(snapshots).toHaveLength(1);
      expect(outbox).toHaveLength(1);
      expect(snapshots[0].ciphertext).not.toContain("98500.00");
      expect(outbox[0].ciphertext).not.toContain("12500.00");

      const serializedRecords = JSON.stringify({ snapshots, outbox });
      expect(serializedRecords).not.toContain("Private emergency savings");
      expect(serializedRecords).not.toContain("Sensitive offline financial snapshot");
      expect(serializedRecords).not.toContain("Confidential offline purchase");
    } finally {
      database.close();
    }

    await expect(readOfflineSnapshot(771, "dashboard")).resolves.toEqual(privateSnapshot);
    await expect(listPendingOfflineTransactions(771)).resolves.toEqual([
      expect.objectContaining({ payload: privateTransaction, idempotencyKey: "offline-crypto-key-0001" })
    ]);
  });
});
