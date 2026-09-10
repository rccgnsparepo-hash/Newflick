import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

/**
 * Converts a base64 data URL to a binary Blob for storage upload
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(';base64,');
  const contentType = parts[0].split(':')[1] || 'image/png';
  const raw = window.atob(parts[1]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);

  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }

  return new Blob([uInt8Array], { type: contentType });
}

export interface WallpaperUploadResult {
  url: string;
  storagePath?: string;
  isCloudStored: boolean;
  fileSize?: number;
}

/**
 * Uploads a cropped or custom wallpaper file/blob to Firebase Storage.
 * Securely places user wallpapers in user-scoped folders: `wallpapers/{userId}/{timestamp}_{cleanFileName}`.
 * Gracefully falls back to optimized data URL if Firebase Storage is unavailable or unconfigured.
 */
export async function uploadWallpaperToStorage(
  fileOrDataUrl: File | Blob | string,
  userId: string = 'anonymous',
  originalFileName: string = 'wallpaper.png',
  onProgress?: (progressPercent: number) => void
): Promise<WallpaperUploadResult> {
  let blob: Blob;

  if (typeof fileOrDataUrl === 'string') {
    if (fileOrDataUrl.startsWith('data:')) {
      blob = dataUrlToBlob(fileOrDataUrl);
    } else {
      // Already an external URL or Firebase Storage URL
      return {
        url: fileOrDataUrl,
        isCloudStored: true
      };
    }
  } else {
    blob = fileOrDataUrl;
  }

  const cleanName = originalFileName
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .toLowerCase();
  const fileExt = cleanName.match(/\.([a-z0-9]+)$/)?.[1] || 'png';
  const timestamp = Date.now();
  const safeUserId = userId ? userId.replace(/[^a-zA-Z0-9_-]/g, '') : 'public';
  const storagePath = `wallpapers/${safeUserId}/${timestamp}_custom_wallpaper.${fileExt}`;

  // If Firebase Storage instance is available
  if (storage) {
    try {
      const storageRef = ref(storage, storagePath);
      const metadata = {
        contentType: blob.type || 'image/png',
        customMetadata: {
          uploaderUserId: userId,
          originalName: originalFileName,
          createdAt: new Date().toISOString()
        }
      };

      const uploadTask = uploadBytesResumable(storageRef, blob, metadata);

      return await new Promise<WallpaperUploadResult>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            if (snapshot.totalBytes > 0) {
              const progress = Math.round(
                (snapshot.bytesTransferred / snapshot.totalBytes) * 100
              );
              onProgress?.(progress);
            }
          },
          (error) => {
            console.warn('[Firebase Storage] Upload error, falling back to local data URL:', error);
            // Fallback gracefully so the user is never stranded
            if (typeof fileOrDataUrl === 'string') {
              resolve({
                url: fileOrDataUrl,
                isCloudStored: false,
                fileSize: blob.size
              });
            } else {
              const reader = new FileReader();
              reader.onload = () => {
                resolve({
                  url: reader.result as string,
                  isCloudStored: false,
                  fileSize: blob.size
                });
              };
              reader.onerror = () => reject(error);
              reader.readAsDataURL(blob);
            }
          },
          async () => {
            try {
              const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
              onProgress?.(100);
              resolve({
                url: downloadUrl,
                storagePath,
                isCloudStored: true,
                fileSize: blob.size
              });
            } catch (urlError) {
              console.warn('[Firebase Storage] getDownloadURL error:', urlError);
              // Fallback
              if (typeof fileOrDataUrl === 'string') {
                resolve({
                  url: fileOrDataUrl,
                  isCloudStored: false,
                  fileSize: blob.size
                });
              } else {
                const reader = new FileReader();
                reader.onload = () => {
                  resolve({
                    url: reader.result as string,
                    isCloudStored: false,
                    fileSize: blob.size
                  });
                };
                reader.readAsDataURL(blob);
              }
            }
          }
        );
      });
    } catch (err) {
      console.warn('[Firebase Storage] Execution error:', err);
    }
  }

  // Fallback if storage not ready: convert blob to data URL
  if (typeof fileOrDataUrl === 'string') {
    return {
      url: fileOrDataUrl,
      isCloudStored: false,
      fileSize: blob.size
    };
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      onProgress?.(100);
      resolve({
        url: reader.result as string,
        isCloudStored: false,
        fileSize: blob.size
      });
    };
    reader.readAsDataURL(blob);
  });
}
