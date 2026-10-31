import {
  listPendingOfflineTransactions,
  removeOfflineTransaction
} from "./offlineStore";

export type OfflineTransactionSender = (
  payload: Record<string, unknown>,
  idempotencyKey: string
) => Promise<unknown>;

export type OfflineSyncResult = {
  synced: number;
  remaining: number;
  blockedBy: string | null;
};

export async function syncPendingOfflineTransactions(
  userId: string | number,
  sendTransaction: OfflineTransactionSender
): Promise<OfflineSyncResult> {
  const pending = await listPendingOfflineTransactions(userId);
  let synced = 0;
  let blockedBy: string | null = null;

  for (const item of pending) {
    try {
      await sendTransaction(item.payload, item.idempotencyKey);
      await removeOfflineTransaction(userId, item.id);
      synced += 1;
    } catch (error) {
      blockedBy = error instanceof Error ? error.message : "A pending transaction could not be synchronized.";
      // Preserve this item and all later items. Retrying the same idempotency
      // key is safe if the server committed but the response was lost.
      break;
    }
  }

  const remaining = await listPendingOfflineTransactions(userId);
  return { synced, remaining: remaining.length, blockedBy };
}
