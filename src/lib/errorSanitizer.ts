/**
 * Centralized Error Sanitizer Utility for Faraflick
 * Safely parses any database, auth, or node transaction error message.
 * Strips out internal system details, JWT tokens, authInfo fields, User IDs, and raw stack/JSON code.
 * Exposes only a high-level secure warning or clean error explanation.
 */

export function sanitizeErrorMessage(err: any): string {
  if (!err) {
    return 'Secure node transmission failed due to unknown spectrum variables.';
  }

  // Get raw message string
  let rawMsg = '';
  if (typeof err === 'string') {
    rawMsg = err;
  } else if (err.message && typeof err.message === 'string') {
    rawMsg = err.message;
  } else {
    try {
      rawMsg = JSON.stringify(err);
    } catch {
      rawMsg = String(err);
    }
  }

  // Helper to extract error message from a parsed object
  const getCleanFromObj = (obj: any): string | null => {
    if (!obj || typeof obj !== 'object') return null;
    
    // Check nested errors first
    if (obj.error) {
      if (typeof obj.error === 'string') return obj.error;
      if (typeof obj.error === 'object') {
        const nested = getCleanFromObj(obj.error);
        if (nested) return nested;
      }
    }
    
    if (obj.message && typeof obj.message === 'string') {
      return obj.message;
    }
    
    return null;
  };

  // 1. Check if the message is already a pure JSON string
  try {
    const trimmed = rawMsg.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const parsed = JSON.parse(trimmed);
      const clean = getCleanFromObj(parsed);
      if (clean) return clean;
    }
  } catch {
    // If pure parsing fails, we'll continue to substring/regex matching
  }

  // 2. Check if there is a JSON block nested inside a string (e.g. "Failed to endorse packet: {...}")
  const jsonRegex = /\{[\s\S]*\}/;
  const match = rawMsg.match(jsonRegex);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      const clean = getCleanFromObj(parsed);
      if (clean) {
        // Construct clean message with the prefix before the JSON block
        const prefixIndex = rawMsg.indexOf(match[0]);
        const prefix = rawMsg.substring(0, prefixIndex).trim();
        // Remove trailing colons/dashes from prefix
        const cleanPrefix = prefix.replace(/[:\-×!]+$/, '').trim();
        return cleanPrefix ? `${cleanPrefix}: ${clean}` : clean;
      }
    } catch {
      // Nested JSON block was not perfectly valid, continue
    }
  }

  // 3. Fallback: If it contains authInfo, userId, or credential metadata, completely sanitize it
  let cleaned = rawMsg;
  const sensitiveKeywords = ['authInfo', 'userId', 'emailVerified', 'tenantId', 'providerInfo', 'accessToken', 'client_id'];
  const hasSensitiveData = sensitiveKeywords.some(keyword => cleaned.includes(keyword));

  if (hasSensitiveData) {
    // Try to recover a clean "error" property before stripping
    const errorPropMatch = cleaned.match(/"error"\s*:\s*"([^"]+)"/i);
    if (errorPropMatch && errorPropMatch[1]) {
      cleaned = errorPropMatch[1];
    } else {
      cleaned = 'Secure handshaking failed. Access/credential mismatch in spectrum node.';
    }
  }

  // 4. Remove common email strings to prevent doxxing
  cleaned = cleaned.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED_IDENTITY]');

  // 5. Remove long alphanumeric keys or tokens that look like JWTs or credentials
  cleaned = cleaned.replace(/[a-zA-Z0-9_\-]{20,}\.[a-zA-Z0-9_\-]{20,}\.[a-zA-Z0-9_\-]{20,}/g, '[REDACTED_ACCESS_TOKEN]');

  // 6. Shorten excessively long generic messages
  if (cleaned.length > 180) {
    cleaned = cleaned.substring(0, 175) + '... [METADATA_PRUNED]';
  }

  // Clean common Firebase/Technical prefixes
  cleaned = cleaned.replace(/^Firebase:\s*/i, '');

  return cleaned;
}
