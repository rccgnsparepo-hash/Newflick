import { LanRepository } from '../database/repository';
import { SyncOperation } from '../shared/types';

export class SyncQueueManager {
  private repo: LanRepository;

  constructor(repo: LanRepository) {
    this.repo = repo;
  }

  public enqueueOperation(op: SyncOperation): boolean {
    if (this.repo.hasOperationBeenProcessed(op.operationId)) {
      console.log(`[Sync Queue] Idempotent skip: Operation ${op.operationId} already processed.`);
      return false;
    }
    this.repo.recordSyncOperation(op);
    return true;
  }

  public getPending(): SyncOperation[] {
    return this.repo.getPendingSyncOperations();
  }

  public markSynced(operationId: string) {
    this.repo.markOperationSynced(operationId);
  }
}
