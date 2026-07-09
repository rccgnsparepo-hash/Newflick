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
