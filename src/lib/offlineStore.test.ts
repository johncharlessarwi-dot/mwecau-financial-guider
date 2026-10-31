import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearUserOfflineData,
  readOfflineSnapshot,
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
    await saveOfflineSnapshot(17, "dashboard", { balance: 1000 });
    await saveOfflineSnapshot(29, "dashboard", { balance: 9000 });

    await clearUserOfflineData(17);

    await expect(readOfflineSnapshot(17, "dashboard")).resolves.toBeNull();
    await expect(readOfflineSnapshot(29, "dashboard")).resolves.toEqual({ balance: 9000 });
  });

  it("rejects blank account IDs and resource names", async () => {
    await expect(saveOfflineSnapshot(" ", "dashboard", {})).rejects.toThrow("A valid account ID is required");
    await expect(saveOfflineSnapshot(17, " ", {})).rejects.toThrow("snapshot resource name is required");
  });
});
