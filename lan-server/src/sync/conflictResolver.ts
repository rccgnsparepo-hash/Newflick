import { SyncOperation } from '../shared/types';

export class ConflictResolver {
  // Deterministic conflict resolution strategy
  public resolveConflict(localOp: SyncOperation, remoteOp: SyncOperation): { winner: SyncOperation; strategy: string } {
    // Strategy 1: Compare version sequence numbers
    if (localOp.version > remoteOp.version) {
      return { winner: localOp, strategy: 'HIGHER_VERSION' };
    }
    if (remoteOp.version > localOp.version) {
      return { winner: remoteOp, strategy: 'HIGHER_VERSION' };
    }

    // Strategy 2: Last Write Wins based on ISO Timestamp
    const localTime = new Date(localOp.createdAt).getTime();
    const remoteTime = new Date(remoteOp.createdAt).getTime();

    if (localTime >= remoteTime) {
      return { winner: localOp, strategy: 'LAST_WRITE_WINS_LOCAL' };
    } else {
      return { winner: remoteOp, strategy: 'LAST_WRITE_WINS_REMOTE' };
    }
  }
}
