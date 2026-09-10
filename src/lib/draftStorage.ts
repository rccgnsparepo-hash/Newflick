/**
 * Draft Storage Manager for Flick Web App
 * Handles infallible auto-saving, retrieval, and cleanup of conversation drafts,
 * poll creation states, and active chat session states in localStorage and local IndexedDB.
 */

import { updateConversationDraft } from './deviceStorageEngine';

export interface PollDraft {
  question: string;
  options: string[];
  updatedAt: number;
}

export interface ActiveChatSession {
  chatId: string;
  peerId?: string;
  isGroup: boolean;
  timestamp: number;
}

/**
 * Generate standard and legacy-compatible draft storage keys
 */
export function getDraftStorageKeys(userId: string, chatId: string, peerId?: string, isGroup?: boolean): string[] {
  const keys: string[] = [];
  if (chatId) {
    keys.push(`fara_flick_draft_${userId}_${chatId}`);
    keys.push(`flick_draft_${chatId}`);
  }
  if (isGroup && chatId) {
    keys.push(`fara_flick_draft_${userId}_group_${chatId}`);
  }
  if (peerId) {
    keys.push(`fara_flick_draft_${userId}_${peerId}`);
    keys.push(`flick_draft_peer_${peerId}`);
  }
  return keys;
}

/**
 * Save draft text for a conversation to local storage
 */
export function saveChatDraft(
  userId: string,
  chatId: string,
  draft: string,
  peerId?: string,
  isGroup?: boolean
): void {
  if (!userId || !chatId) return;

  const trimmed = draft ?? '';
  const primaryKey = `fara_flick_draft_${userId}_${chatId}`;
  const groupKey = isGroup ? `fara_flick_draft_${userId}_group_${chatId}` : null;
  const peerKey = peerId ? `fara_flick_draft_${userId}_${peerId}` : null;

  try {
    if (trimmed.trim().length > 0) {
      localStorage.setItem(primaryKey, trimmed);
      if (groupKey) localStorage.setItem(groupKey, trimmed);
      if (peerKey) localStorage.setItem(peerKey, trimmed);
      localStorage.setItem(`fara_flick_draft_time_${userId}_${chatId}`, Date.now().toString());

      // Also asynchronously mirror to Device Vault DB (IndexedDB)
      updateConversationDraft(chatId, trimmed).catch(() => {});
    } else {
      clearChatDraft(userId, chatId, peerId, isGroup);
    }
  } catch (err) {
    console.warn('[DraftStorage] Failed saving draft to localStorage:', err);
  }
}

/**
 * Retrieve saved draft text for a conversation from local storage
 */
export function getChatDraft(
  userId: string,
  chatId: string,
  peerId?: string,
  isGroup?: boolean
): string {
  if (!userId || !chatId) return '';

  const candidateKeys = getDraftStorageKeys(userId, chatId, peerId, isGroup);

  try {
    for (const key of candidateKeys) {
      const val = localStorage.getItem(key);
      if (val !== null && val.trim().length > 0) {
        return val;
      }
    }
  } catch (err) {
    console.warn('[DraftStorage] Failed reading draft from localStorage:', err);
  }

  return '';
}

/**
 * Clear saved draft text for a conversation
 */
export function clearChatDraft(
  userId: string,
  chatId: string,
  peerId?: string,
  isGroup?: boolean
): void {
  if (!userId) return;

  const candidateKeys = getDraftStorageKeys(userId, chatId, peerId, isGroup);
  candidateKeys.push(`fara_flick_draft_time_${userId}_${chatId}`);

  try {
    for (const key of candidateKeys) {
      localStorage.removeItem(key);
    }
    if (chatId) {
      updateConversationDraft(chatId, '').catch(() => {});
    }
  } catch (err) {
    console.warn('[DraftStorage] Failed clearing draft from localStorage:', err);
  }
}

/**
 * Persist the current active chat session ID and metadata so that upon refresh
 * or navigating away to another section (e.g. Status, News, Profile) and back,
 * the user is directly restored to the conversation with their text draft intact.
 */
export function saveActiveChatSession(
  userId: string,
  chatId: string,
  peerId?: string,
  isGroup: boolean = false
): void {
  if (!userId || !chatId) return;

  try {
    const session: ActiveChatSession = {
      chatId,
      peerId,
      isGroup,
      timestamp: Date.now()
    };
    localStorage.setItem(`fara_last_active_session_${userId}`, JSON.stringify(session));
    localStorage.setItem(`fara_last_active_chat_${userId}`, chatId);
    if (peerId) {
      localStorage.setItem(`fara_last_active_peer_${userId}`, peerId);
    } else {
      localStorage.removeItem(`fara_last_active_peer_${userId}`);
    }
    localStorage.setItem(`fara_last_active_is_group_${userId}`, isGroup ? '1' : '0');
  } catch (err) {
    console.warn('[DraftStorage] Failed saving active chat session:', err);
  }
}

/**
 * Retrieve the last active chat session
 */
export function getLastActiveChatSession(userId: string): ActiveChatSession | null {
  if (!userId) return null;

  try {
    const raw = localStorage.getItem(`fara_last_active_session_${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.chatId) {
        return parsed as ActiveChatSession;
      }
    }

    // Fallback to individual keys
    const chatId = localStorage.getItem(`fara_last_active_chat_${userId}`);
    if (chatId) {
      const peerId = localStorage.getItem(`fara_last_active_peer_${userId}`) || undefined;
      const isGroup = localStorage.getItem(`fara_last_active_is_group_${userId}`) === '1';
      return {
        chatId,
        peerId,
        isGroup,
        timestamp: Date.now()
      };
    }
  } catch (err) {
    console.warn('[DraftStorage] Failed retrieving active chat session:', err);
  }

  return null;
}

/**
 * Clear the active chat session (e.g. when user explicitly closes the conversation or goes back to standby)
 */
export function clearActiveChatSession(userId: string): void {
  if (!userId) return;

  try {
    localStorage.removeItem(`fara_last_active_session_${userId}`);
    localStorage.removeItem(`fara_last_active_chat_${userId}`);
    localStorage.removeItem(`fara_last_active_peer_${userId}`);
    localStorage.removeItem(`fara_last_active_is_group_${userId}`);
  } catch (err) {
    console.warn('[DraftStorage] Failed clearing active chat session:', err);
  }
}

/**
 * Save in-progress poll creator drafts
 */
export function savePollDraft(userId: string, chatId: string, question: string, options: string[]): void {
  if (!userId || !chatId) return;

  try {
    const hasContent = question.trim().length > 0 || options.some(opt => opt.trim().length > 0);
    const key = `fara_poll_draft_${userId}_${chatId}`;
    if (hasContent) {
      const draft: PollDraft = { question, options, updatedAt: Date.now() };
      localStorage.setItem(key, JSON.stringify(draft));
    } else {
      localStorage.removeItem(key);
    }
  } catch (err) {
    console.warn('[DraftStorage] Failed saving poll draft:', err);
  }
}

/**
 * Retrieve saved poll creator draft
 */
export function getPollDraft(userId: string, chatId: string): PollDraft | null {
  if (!userId || !chatId) return null;

  try {
    const raw = localStorage.getItem(`fara_poll_draft_${userId}_${chatId}`);
    if (raw) {
      return JSON.parse(raw) as PollDraft;
    }
  } catch (err) {
    console.warn('[DraftStorage] Failed retrieving poll draft:', err);
  }

  return null;
}

/**
 * Clear saved poll creator draft
 */
export function clearPollDraft(userId: string, chatId: string): void {
  if (!userId || !chatId) return;

  try {
    localStorage.removeItem(`fara_poll_draft_${userId}_${chatId}`);
  } catch (err) {
    console.warn('[DraftStorage] Failed clearing poll draft:', err);
  }
}

/**
 * Save message inline edit draft
 */
export function saveMessageEditDraft(userId: string, messageId: string, text: string): void {
  if (!userId || !messageId) return;

  try {
    const key = `fara_msg_edit_draft_${userId}_${messageId}`;
    if (text.trim().length > 0) {
      localStorage.setItem(key, text);
    } else {
      localStorage.removeItem(key);
    }
  } catch (err) {
    console.warn('[DraftStorage] Failed saving message edit draft:', err);
  }
}

/**
 * Retrieve message inline edit draft
 */
export function getMessageEditDraft(userId: string, messageId: string): string {
  if (!userId || !messageId) return '';

  try {
    return localStorage.getItem(`fara_msg_edit_draft_${userId}_${messageId}`) || '';
  } catch {
    return '';
  }
}

/**
 * Clear message inline edit draft
 */
export function clearMessageEditDraft(userId: string, messageId: string): void {
  if (!userId || !messageId) return;

  try {
    localStorage.removeItem(`fara_msg_edit_draft_${userId}_${messageId}`);
  } catch {}
}
