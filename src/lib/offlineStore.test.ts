import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearUserOfflineData,
  enqueueOfflineTransaction,
  listPendingOfflineTransactions,
  readOfflineSnapshot,
  removeOfflineTransaction,
  saveOfflineSnapshot
} from "./offlineStore";

let randomCounter = 0;
let keyCounter = 0;

const fakeCrypto = {
  getRandomValues<T extends ArrayBufferView>(array: T): T {
    new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(++randomCounter);
    return array;
  },
  subtle: {
    generateKey: vi.fn(async () => ({ keyId: ++keyCounter } as unknown as CryptoKey)),
    encrypt: vi.fn(async (_algorithm: unknown, _key: unknown, plaintext: Uint8Array) => plaintext.slice().buffer),
    decrypt: vi.fn(async (_algorithm: unknown, _key: unknown, ciphertext: Uint8Array) => ciphertext.slice().buffer)
  }
} as unknown as Crypto;

describe("encrypted account-scoped offline snapshots", () => {
  beforeEach(() => {
    randomCounter = 0;
    keyCounter = 0;
    vi.stubGlobal("crypto", fakeCrypto);
  });

  it("stores and reads a snapshot for the same account", async () => {
    const snapshot = { balance: 42500, currency: "TZS", transactions: [{ id: 4, amount: 1200 }] };
    await saveOfflineSnapshot(17, "dashboard", snapshot);

    await expect(readOfflineSnapshot(17, "dashboard")).resolves.toEqual(snapshot);
  });

  it("isolates identical snapshot names across different accounts", async () => {
    await saveOfflineSnapshot(17, "dashboard", { balance: 1000 });
    await saveOfflineSnapshot(29, "dashboard", { balance: 9000 });

    await expect(readOfflineSnapshot(17, "dashboard")).resolves.toEqual({ balance: 1000 });
    await expect(readOfflineSnapshot(29, "dashboard")).resolves.toEqual({ balance: 9000 });
  });

  it("does not expose snapshots to another account ID", async () => {
    await saveOfflineSnapshot(17, "ledger", { transactions: [{ description: "Private record" }] });

    await expect(readOfflineSnapshot(29, "ledger")).resolves.toBeNull();
  });

  it("clears only the selected account's snapshots and encryption key", async () => {
    await saveOfflineSnapshot(170, "dashboard", { balance: 1000 });
    await saveOfflineSnapshot(290, "dashboard", { balance: 9000 });
    await enqueueOfflineTransaction(170, "offline-transaction-key-0017", { amount: "100.00" });
    await enqueueOfflineTransaction(290, "offline-transaction-key-0029", { amount: "900.00" });

    await clearUserOfflineData(170);

    await expect(readOfflineSnapshot(170, "dashboard")).resolves.toBeNull();
    await expect(readOfflineSnapshot(290, "dashboard")).resolves.toEqual({ balance: 9000 });
    await expect(listPendingOfflineTransactions(170)).resolves.toHaveLength(0);
    await expect(listPendingOfflineTransactions(290)).resolves.toHaveLength(1);
  });

  it("queues encrypted transactions and returns the decrypted pending payload", async () => {
    const payload = {account_id:4,type:"expense",amount:"1500.00",description:"Offline bus fare",occurred_at:"2026-10-31T08:00:00.000Z"};
    await enqueueOfflineTransaction(17,"offline-transaction-key-0001",payload);

    await expect(listPendingOfflineTransactions(17)).resolves.toEqual([
      expect.objectContaining({id:"17:offline-transaction-key-0001",idempotencyKey:"offline-transaction-key-0001",payload})
    ]);
  });

  it("does not duplicate a queued transaction when the same key and payload are submitted again", async () => {
    const payload = {account_id:4,type:"expense",amount:"1500.00"};
    await enqueueOfflineTransaction(17,"offline-transaction-key-0002",payload);
    await enqueueOfflineTransaction(17,"offline-transaction-key-0002",payload);

    await expect(listPendingOfflineTransactions(17)).resolves.toHaveLength(1);
  });

  it("rejects reuse of an offline key with a different payload", async () => {
    await enqueueOfflineTransaction(17,"offline-transaction-key-0003",{amount:"100.00"});
    await expect(enqueueOfflineTransaction(17,"offline-transaction-key-0003",{amount:"200.00"}))
      .rejects.toThrow("already assigned to a different payload");
  });

  it("keeps pending transactions isolated by account", async () => {
    await enqueueOfflineTransaction(17,"offline-transaction-key-0004",{amount:"100.00"});
    await enqueueOfflineTransaction(29,"offline-transaction-key-0005",{amount:"900.00"});

    await expect(listPendingOfflineTransactions(17)).resolves.toHaveLength(1);
    await expect(listPendingOfflineTransactions(129)).resolves.toHaveLength(1);
  });

  it("removes only the selected account's queued transaction", async () => {
    await enqueueOfflineTransaction(17,"offline-transaction-key-0006",{amount:"100.00"});
    await enqueueOfflineTransaction(29,"offline-transaction-key-0007",{amount:"900.00"});

    await removeOfflineTransaction(17,"17:offline-transaction-key-0006");

    await expect(listPendingOfflineTransactions(17)).resolves.toHaveLength(0);
    await expect(listPendingOfflineTransactions(139)).resolves.toHaveLength(1);
  });

  it("rejects blank account IDs and resource names", async () => {
    await expect(saveOfflineSnapshot(" ", "dashboard", {})).rejects.toThrow("A valid account ID is required");
    await expect(saveOfflineSnapshot(17, " ", {})).rejects.toThrow("snapshot resource name is required");
  });
});
