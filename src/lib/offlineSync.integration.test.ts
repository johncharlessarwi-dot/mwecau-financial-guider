import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  enqueueOfflineTransaction,
  listPendingOfflineTransactions
} from "./offlineStore";
import { syncPendingOfflineTransactions } from "./offlineSync";

const DATABASE_NAME = "mwecau-guider-private-offline";

describe("offline storage-to-sync integration", () => {
  beforeEach(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DATABASE_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("Offline test database is blocked."));
    });
    const nodeCrypto = await import("node:crypto" as string) as { webcrypto: Crypto };
    vi.stubGlobal("crypto", nodeCrypto.webcrypto);
  });

  it("sends encrypted queued transactions in order and removes only confirmed writes", async () => {
    await enqueueOfflineTransaction(881, "offline-integration-key-0001", {
      amount: "1200.00",
      description: "Bus fare"
    });
    await enqueueOfflineTransaction(881, "offline-integration-key-0002", {
      amount: "2500.00",
      description: "Food"
    });

    const sender = vi.fn().mockResolvedValue({ status: 201 });
    const result = await syncPendingOfflineTransactions(881, sender);

    expect(sender).toHaveBeenNthCalledWith(1,
      { amount: "1200.00", description: "Bus fare" },
      "offline-integration-key-0001"
    );
    expect(sender).toHaveBeenNthCalledWith(2,
      { amount: "2500.00", description: "Food" },
      "offline-integration-key-0002"
    );
    expect(result).toEqual({ synced: 2, remaining: 0, blockedBy: null });
    await expect(listPendingOfflineTransactions(881)).resolves.toEqual([]);
  });

  it("preserves the failed item and all later items when the API is unavailable", async () => {
    await enqueueOfflineTransaction(882, "offline-integration-key-0003", {
      amount: "3000.00",
      description: "Pending rent"
    });
    await enqueueOfflineTransaction(882, "offline-integration-key-0004", {
      amount: "4000.00",
      description: "Pending utilities"
    });

    const sender = vi.fn().mockRejectedValue(new Error("Finance API unavailable."));
    const result = await syncPendingOfflineTransactions(882, sender);

    expect(sender).toHaveBeenCalledOnce();
    expect(result).toEqual({
      synced: 0,
      remaining: 2,
      blockedBy: "Finance API unavailable."
    });
    await expect(listPendingOfflineTransactions(882)).resolves.toHaveLength(2);
  });


  it("retries an ambiguous committed write with the exact same idempotency key", async () => {
    const payload = {
      amount: "7600.00",
      description: "Transfer whose response was lost"
    };
    const idempotencyKey = "offline-integration-key-0006";
    await enqueueOfflineTransaction(884, idempotencyKey, payload);

    const sender = vi.fn()
      .mockRejectedValueOnce(new Error("Response lost after server commit."))
      .mockResolvedValueOnce({ status: 201, replayed: true });

    const firstAttempt = await syncPendingOfflineTransactions(884, sender);
    expect(firstAttempt).toEqual({
      synced: 0,
      remaining: 1,
      blockedBy: "Response lost after server commit."
    });
    await expect(listPendingOfflineTransactions(884)).resolves.toHaveLength(1);

    const retry = await syncPendingOfflineTransactions(884, sender);
    expect(retry).toEqual({ synced: 1, remaining: 0, blockedBy: null });
    expect(sender).toHaveBeenNthCalledWith(1, payload, idempotencyKey);
    expect(sender).toHaveBeenNthCalledWith(2, payload, idempotencyKey);
    await expect(listPendingOfflineTransactions(884)).resolves.toEqual([]);
  });

  it("keeps the queue intact when authentication expires during synchronization", async () => {
    await enqueueOfflineTransaction(883, "offline-integration-key-0005", {
      amount: "500.00",
      description: "Offline purchase"
    });

    const sender = vi.fn().mockRejectedValue(
      Object.assign(new Error("Session expired."), { status: 401 })
    );

    await expect(syncPendingOfflineTransactions(883, sender))
      .rejects.toMatchObject({ status: 401 });
    await expect(listPendingOfflineTransactions(883)).resolves.toHaveLength(1);
  });
});
