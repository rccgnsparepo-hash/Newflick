import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

export class FileStorageManager {
  private mediaDir: string;

  constructor(dataDir: string) {
    this.mediaDir = path.join(dataDir, 'media');
    this.initDirectories();
  }

  private initDirectories() {
    const subdirs = ['images', 'videos', 'audio', 'documents', 'stories', 'avatars'];
    subdirs.forEach((dir) => {
      const fullPath = path.join(this.mediaDir, dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
    });
  }

  public saveFile(fileBuffer: Buffer, category: 'images' | 'videos' | 'audio' | 'documents' | 'stories' | 'avatars', originalName: string): {
    filePath: string;
    fileHash: string;
    fileSize: number;
    fileName: string;
    publicUrl: string;
  } {
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const ext = path.extname(originalName) || '.bin';
    const fileName = `${hash}${ext}`;
    const targetPath = path.join(this.mediaDir, category, fileName);

    if (!fs.existsSync(targetPath)) {
      fs.writeFileSync(targetPath, fileBuffer);
    }

    const publicUrl = `/media/${category}/${fileName}`;

    return {
      filePath: targetPath,
      fileHash: hash,
      fileSize: fileBuffer.length,
      fileName,
      publicUrl
    };
  }

  public getMediaDir(): string {
    return this.mediaDir;
  }

  public getDirectorySizeMB(): number {
    try {
      let totalBytes = 0;
      const getDirSize = (dirPath: string) => {
        const files = fs.readdirSync(dirPath);
        for (const f of files) {
          const filePath = path.join(dirPath, f);
          const stats = fs.statSync(filePath);
          if (stats.isDirectory()) {
            getDirSize(filePath);
          } else {
            totalBytes += stats.size;
          }
        }
      };
      if (fs.existsSync(this.mediaDir)) {
        getDirSize(this.mediaDir);
      }
      return parseFloat((totalBytes / (1024 * 1024)).toFixed(2));
    } catch {
      return 0;
    }
  }
}
