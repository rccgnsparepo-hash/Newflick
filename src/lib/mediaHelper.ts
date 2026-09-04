/**
 * Media Helper Utility for Client-Side Compression and Conversion.
 * Ensures images fit cleanly under the Firestore 1MB document limit.
 */

/**
 * File size threshold warning for database constraints (set to 1GB as requested)
 */
export const MAX_MEDIA_SIZE_BYTES = 1024 * 1024 * 1024; // 1GB Limit

/**
 * Compresses an image file and converts it to a standard highly compressed JPEG Base64 string.
 */
export async function compressImage(file: File, maxWidth = 600, maxHeight = 600, quality = 0.5): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Apply aspect ratio scale limits
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string); // fallback to raw
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error("Failed to load image file for compression."));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });
}

/**
 * Converts any audio/video/file to base64 with smart auto-compression for massive files.
 */
export async function fileToBase64(file: File, qualityMode?: 'original' | 'compressed' | 'saver'): Promise<string> {
  if (file.size > MAX_MEDIA_SIZE_BYTES) {
    throw new Error(`Chosen media file is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Limit is 1GB.`);
  }

  // If it is an image, auto-compress underneath the cloud threshold
  if (file.type.startsWith('image/')) {
    try {
      const mode = qualityMode || (localStorage.getItem('flick_upload_quality') as 'original' | 'compressed' | 'saver') || 'compressed';
      let maxWidth = 800;
      let maxHeight = 800;
      let qualityValue = 0.6;

      if (mode === 'original') {
        maxWidth = 2048;
        maxHeight = 2048;
        qualityValue = 0.95;
      } else if (mode === 'saver') {
        maxWidth = 400;
        maxHeight = 400;
        qualityValue = 0.3;
      }
      return await compressImage(file, maxWidth, maxHeight, qualityValue);
    } catch (e) {
      console.warn("Fallback to raw file read");
    }
  }

  // For massive audio/video above cloud limits, warn of potential network latency
  if (file.size > 12 * 1024 * 1024) {
    console.warn("Large asset exceeds cloud single-doc recommendation but permitted by high-capacity pipeline.");
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      resolve(e.target?.result as string);
    };
    reader.onerror = () => reject(new Error("Failed to read file buffer."));
    reader.readAsDataURL(file);
  });
}

/**
 * Helper to identify content category from mime type
 */
export function getMediaTypeFromMime(mimeType: string): 'image' | 'video' | 'audio' | 'none' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'none';
}

/**
 * Format bytes to human readable string (e.g. 1.2 MB)
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Client-Side Media Uploader for Status Stories & Messages.
 * Sends raw or compressed media to the local backend /api/upload endpoint,
 * with automatic fallback to client-side data URLs when suitable.
 */
export async function uploadMediaFile(
  fileOrBlob: File | Blob,
  fileName?: string
): Promise<{ url: string; mediaType: 'image' | 'video' | 'audio'; name: string; size: number }> {
  const mimeType = fileOrBlob.type || 'application/octet-stream';
  const mediaType = getMediaTypeFromMime(mimeType);
  const resolvedName = fileName || (fileOrBlob instanceof File ? fileOrBlob.name : `recording_${Date.now()}`);

  let base64Data: string;

  if (fileOrBlob instanceof File && mediaType === 'image') {
    // Compress images to high-def web dimensions (e.g., 1080x1080) for instant loading
    try {
      base64Data = await compressImage(fileOrBlob, 1080, 1080, 0.8);
    } catch {
      base64Data = await fileToBase64(fileOrBlob);
    }
  } else if (fileOrBlob instanceof File) {
    base64Data = await fileToBase64(fileOrBlob);
  } else {
    // It's a Blob (e.g. recorded audio)
    base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error('Failed to read media blob'));
      reader.readAsDataURL(fileOrBlob);
    });
  }

  // Attempt backend storage upload
  try {
    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileData: base64Data,
        fileName: resolvedName,
        mimeType
      })
    });

    if (response.ok) {
      const data = await response.json();
      return {
        url: data.url,
        mediaType: mediaType === 'none' ? 'image' : mediaType,
        name: data.fileName || resolvedName,
        size: data.size || fileOrBlob.size
      };
    }
  } catch (err) {
    console.warn('[uploadMediaFile] Remote upload API unavailable, evaluating data URL fallback:', err);
  }

  // If server storage upload fails, use data URL directly
  return {
    url: base64Data,
    mediaType: mediaType === 'none' ? 'image' : mediaType,
    name: resolvedName,
    size: fileOrBlob.size
  };
}

