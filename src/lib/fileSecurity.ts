// Secure file upload validation and sanitization

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  sanitizedFilename?: string;
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
  'audio/mp3',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'application/pdf',
  'text/plain'
]);

const ALLOWED_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp',
  'mp4', 'webm', 'mp3', 'wav', 'ogg',
  'pdf', 'txt'
]);

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB max limit

export function validateFileUpload(file: File, currentUserId: string): FileValidationResult {
  if (!currentUserId) {
    return { valid: false, error: 'Unauthorized upload attempt: Missing user identity.' };
  }

  if (!file) {
    return { valid: false, error: 'No file provided.' };
  }

  // 1. Check size limit
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size exceeds the maximum limit of 50MB (Provided: ${(file.size / (1024 * 1024)).toFixed(1)}MB).`
    };
  }

  // 2. Validate MIME type
  const mimeType = file.type?.toLowerCase() || '';
  if (mimeType && !ALLOWED_MIME_TYPES.has(mimeType)) {
    return {
      valid: false,
      error: `Unsupported file type: "${file.type}". Allowed formats: images, videos, audio, PDF, TXT.`
    };
  }

  // 3. Extract and validate file extension
  const originalName = file.name || 'unnamed_file';
  const parts = originalName.split('.');
  const rawExtension = parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';

  if (rawExtension && !ALLOWED_EXTENSIONS.has(rawExtension)) {
    return {
      valid: false,
      error: `Invalid file extension ".${rawExtension}".`
    };
  }

  // 4. Generate clean safe storage filename
  const timestamp = Date.now();
  const randomEntropy = Math.random().toString(36).substring(2, 8);
  const cleanExtension = rawExtension ? `.${rawExtension}` : '';
  const sanitizedFilename = `user_${currentUserId}_${timestamp}_${randomEntropy}${cleanExtension}`;

  return {
    valid: true,
    sanitizedFilename
  };
}
