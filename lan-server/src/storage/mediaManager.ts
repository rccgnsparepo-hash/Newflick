import { FileStorageManager } from './fileStorage';
import { LanRepository } from '../database/repository';

export class MediaManager {
  private fileStorage: FileStorageManager;
  private repo: LanRepository;

  constructor(fileStorage: FileStorageManager, repo: LanRepository) {
    this.fileStorage = fileStorage;
    this.repo = repo;
  }

  public handleUpload(buffer: Buffer, category: 'images' | 'videos' | 'audio' | 'documents' | 'stories' | 'avatars', filename: string, ownerUserId?: string) {
    const result = this.fileStorage.saveFile(buffer, category, filename);

    // Save attachment metadata record
    this.repo.logAudit('MEDIA_UPLOAD', ownerUserId, '127.0.0.1', {
      hash: result.fileHash,
      fileName: result.fileName,
      size: result.fileSize
    });

    return result;
  }
}
