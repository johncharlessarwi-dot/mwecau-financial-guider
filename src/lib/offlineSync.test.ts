import { beforeEach, describe, expect, it, vi } from "vitest";
import { listPendingOfflineTransactions, removeOfflineTransaction } from "./offlineStore";
import { syncPendingOfflineTransactions } from "./offlineSync";

const offlineMocks = vi.hoisted(() => ({
  listPendingOfflineTransactions: vi.fn(),
  removeOfflineTransaction: vi.fn()
}));
vi.mock("./offlineStore", () => offlineMocks);

const first = {
  id: "7:key-1",
  idempotencyKey: "key-1-12345678901234567890",
  payload: {description:"Offline fare",amount:"1200.00"},
  createdAt: 1
};
const second = {
  id: "7:key-2",
  idempotencyKey: "key-2-12345678901234567890",
  payload: {description:"Offline food",amount:"2500.00"},
  createdAt: 2
};

describe("offline transaction synchronization", () => {
  beforeEach(() => {
    offlineMocks.listPendingOfflineTransactions.mockReset();
    offlineMocks.removeOfflineTransaction.mockReset().mockResolvedValue(undefined);
  });

  it("sends queued transactions in order and removes each confirmed item", async () => {
    offlineMocks.listPendingOfflineTransactions
      .mockResolvedValueOnce([first, second])
      .mockResolvedValueOnce([]);
    const sender = vi.fn().mockResolvedValue({data:{id:101}});

    const result = await syncPendingOfflineTransactions(7, sender);

    expect(sender).toHaveBeenNthCalledWith(1, first.payload, first.idempotencyKey);
    expect(sender).toHaveBeenNthCalledWith(2, second.payload, second.idempotencyKey);
    expect(offlineMocks.removeOfflineTransaction).toHaveBeenNthCalledWith(1, 7, first.id);
    expect(offlineMocks.removeOfflineTransaction).toHaveBeenNthCalledWith(2, 7, second.id);
    expect(result).toEqual({synced:2,remaining:0,blockedBy:null});
  });

  it("keeps a failed transaction and later items queued for safe retry", async () => {
    offlineMocks.listPendingOfflineTransactions
      .mockResolvedValueOnce([first, second])
      .mockResolvedValueOnce([first, second]);
    const sender = vi.fn().mockRejectedValue(new Error("The finance API could not be reached."));

    const result = await syncPendingOfflineTransactions(7, sender);

    expect(sender).toHaveBeenCalledOnce();
    expect(offlineMocks.removeOfflineTransaction).not.toHaveBeenCalled();
    expect(result).toEqual({
      synced:0,
      remaining:2,
      blockedBy:"The finance API could not be reached."
    });
  });

  it("removes completed items but preserves the first item that needs attention", async () => {
    offlineMocks.listPendingOfflineTransactions
      .mockResolvedValueOnce([first, second])
      .mockResolvedValueOnce([second]);
    const sender = vi.fn()
      .mockResolvedValueOnce({data:{id:101}})
      .mockRejectedValueOnce(new Error("Transaction category is no longer valid."));

    const result = await syncPendingOfflineTransactions(7, sender);

    expect(offlineMocks.removeOfflineTransaction).toHaveBeenCalledOnce();
    expect(offlineMocks.removeOfflineTransaction).toHaveBeenCalledWith(7, first.id);
    expect(result).toEqual({
      synced:1,
      remaining:1,
      blockedBy:"Transaction category is no longer valid."
    });
  });

  it("does not call the server when there are no pending transactions", async () => {
    offlineMocks.listPendingOfflineTransactions.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const sender = vi.fn();

    const result = await syncPendingOfflineTransactions(7, sender);

    expect(sender).not.toHaveBeenCalled();
    expect(result).toEqual({synced:0,remaining:0,blockedBy:null});
  });
});
