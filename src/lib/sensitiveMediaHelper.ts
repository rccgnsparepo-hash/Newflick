/**
 * Sensitive Media Filtering and Detection Engine for Social Feed
 * Automatically flags sensitive images/keywords and manages user blur/reveal preferences.
 */

import { Post } from '../types';

const SENSITIVE_KEYWORDS = [
  'nsfw',
  'spoiler',
  'spoilers',
  'graphic',
  'violence',
  'violent',
  'gore',
  'blood',
  'injury',
  'accident',
  '18+',
  'adult',
  'mature',
  'trigger warning',
  'tw:',
  'cw:',
  'disturbing',
  'warning',
  'sensitive'
];

export interface SensitiveDetectionResult {
  isSensitive: boolean;
  reason?: string;
  category?: 'spoiler' | 'violence' | 'adult' | 'medical' | 'general';
  confidence: number;
  matchedKeywords: string[];
}

/**
 * Heuristically inspects caption/tags of a post for sensitive triggers
 */
export function detectSensitiveContent(text: string = ''): SensitiveDetectionResult {
  if (!text) {
    return { isSensitive: false, confidence: 0, matchedKeywords: [] };
  }

  const normalized = text.toLowerCase();
  const matchedKeywords: string[] = [];
  let detectedCategory: 'spoiler' | 'violence' | 'adult' | 'medical' | 'general' = 'general';

  for (const kw of SENSITIVE_KEYWORDS) {
    if (normalized.includes(kw)) {
      matchedKeywords.push(kw.toUpperCase());
      if (kw.includes('spoiler')) detectedCategory = 'spoiler';
      else if (kw.includes('violence') || kw.includes('gore') || kw.includes('blood')) detectedCategory = 'violence';
      else if (kw.includes('18+') || kw.includes('adult') || kw.includes('nsfw')) detectedCategory = 'adult';
      else if (kw.includes('injury') || kw.includes('accident')) detectedCategory = 'medical';
    }
  }

  if (matchedKeywords.length > 0) {
    return {
      isSensitive: true,
      reason: `Matched sensitive keyword filter: [${matchedKeywords.join(', ')}]`,
      category: detectedCategory,
      confidence: 0.95,
      matchedKeywords
    };
  }

  return { isSensitive: false, confidence: 0, matchedKeywords: [] };
}

/**
 * Determines if a post's media should be masked with CSS blur
 */
export function isPostMediaBlurRequired(
  post: Post,
  revealedMap: Record<string, boolean> = {},
  filterPreference: 'filter_sensitive' | 'always_blur' | 'always_show' = 'filter_sensitive'
): { shouldBlur: boolean; reason: string; category: string } {
  // If user explicitly revealed it in this session, don't blur unless preference is always_blur
  if (revealedMap[post.id] && filterPreference !== 'always_blur') {
    return { shouldBlur: false, reason: '', category: '' };
  }

  if (filterPreference === 'always_show') {
    return { shouldBlur: false, reason: '', category: '' };
  }

  if (filterPreference === 'always_blur') {
    return {
      shouldBlur: true,
      reason: 'User preference: All media blurred by default',
      category: 'general'
    };
  }

  // Check explicit post flags
  if (post.isSensitive) {
    return {
      shouldBlur: true,
      reason: post.sensitiveReason || 'Content marked as sensitive by author or moderator',
      category: post.sensitiveCategory || 'general'
    };
  }

  if (post.flaggedBy && post.flaggedBy.length >= 1) {
    return {
      shouldBlur: true,
      reason: `Flagged as sensitive by ${post.flaggedBy.length} operator${post.flaggedBy.length > 1 ? 's' : ''}`,
      category: 'community_flagged'
    };
  }

  // Automatic heuristic text scan
  const autoDetect = detectSensitiveContent(post.content);
  if (autoDetect.isSensitive) {
    return {
      shouldBlur: true,
      reason: autoDetect.reason || 'Automatically filtered for sensitive content',
      category: autoDetect.category || 'general'
    };
  }

  return { shouldBlur: false, reason: '', category: '' };
}
