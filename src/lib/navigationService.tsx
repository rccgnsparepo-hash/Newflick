import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

// ==========================================
// 1. Navigation Types & Interfaces
// ==========================================
export interface NavigationState {
  tab: 'home' | 'match' | 'chat' | 'news' | 'profile';
  chatPeerId: string | null;
  chatGroupId: string | null;
  profileId: string | null;
}

export interface NavigationContextType {
  // Navigation State
  activeTab: 'home' | 'match' | 'chat' | 'news' | 'profile';
  setActiveTab: (tab: 'home' | 'match' | 'chat' | 'news' | 'profile') => void;
  deepLinkedPeerId: string | null;
  setDeepLinkedPeerId: (id: string | null) => void;
  deepLinkedGroupId: string | null;
  setDeepLinkedGroupId: (id: string | null) => void;
  viewedProfileId: string | null;
  setViewedProfileId: (id: string | null) => void;

  // Overlays / Modal States
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  isFeedbackOpen: boolean;
  setIsFeedbackOpen: (open: boolean) => void;
  isShortcutsOpen: boolean;
  setIsShortcutsOpen: (open: boolean) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  showOnboarding: boolean;
  setShowOnboarding: (show: boolean) => void;
  isTourOpen: boolean;
  setIsTourOpen: (open: boolean) => void;
  showNotifDropdown: boolean;
  setShowNotifDropdown: (open: boolean) => void;
  isChatScreenOpen: boolean;
  setIsChatScreenOpen: (open: boolean) => void;

  // Navigation History Operations
  pushToHistory: (state: NavigationState) => void;
  goBack: () => boolean;
  clearHistory: () => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a CustomNavigationProvider');
  }
  return context;
}

// ==========================================
// 2. Navigation Provider with Back Button Handler
// ==========================================
export const CustomNavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Main Navigation States with local storage fallbacks to protect against process death
  const [activeTab, setLocalActiveTab] = useState<'home' | 'match' | 'chat' | 'news' | 'profile'>(() => {
    try {
      const saved = localStorage.getItem('faraflick_active_tab');
      return (saved as any) || 'home';
    } catch {
      return 'home';
    }
  });

  const [deepLinkedPeerId, setLocalDeepLinkedPeerId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('faraflick_chat_peer_id') || null;
    } catch {
      return null;
    }
  });

  const [deepLinkedGroupId, setLocalDeepLinkedGroupId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('faraflick_chat_group_id') || null;
    } catch {
      return null;
    }
  });

  const [viewedProfileId, setLocalViewedProfileId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('faraflick_viewed_profile_id') || null;
    } catch {
      return null;
    }
  });

  // Overlay States
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [isChatScreenOpen, setIsChatScreenOpen] = useState(false);

  // History Stack for React views
  const [history, setHistory] = useState<NavigationState[]>(() => {
    try {
      const saved = localStorage.getItem('faraflick_nav_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const isBackNavigating = useRef(false);
  const lastBackPressTime = useRef(0);

  // Helper to push history
  const pushToHistory = (state: NavigationState) => {
    setHistory((prev) => {
      // Avoid inserting duplicates at the top of the stack
      if (prev.length > 0) {
        const top = prev[prev.length - 1];
        if (
          top.tab === state.tab &&
          top.chatPeerId === state.chatPeerId &&
          top.chatGroupId === state.chatGroupId &&
          top.profileId === state.profileId
        ) {
          return prev;
        }
      }
      const updated = [...prev, state];
      try {
        localStorage.setItem('faraflick_nav_history', JSON.stringify(updated));
      } catch (e) {
        // Safe fallback
      }
      return updated;
    });
  };

  // Persist current active view parameters on every change
  useEffect(() => {
    try {
      localStorage.setItem('faraflick_active_tab', activeTab);
      if (deepLinkedPeerId) {
        localStorage.setItem('faraflick_chat_peer_id', deepLinkedPeerId);
      } else {
        localStorage.removeItem('faraflick_chat_peer_id');
      }
      if (deepLinkedGroupId) {
        localStorage.setItem('faraflick_chat_group_id', deepLinkedGroupId);
      } else {
        localStorage.removeItem('faraflick_chat_group_id');
      }
      if (viewedProfileId) {
        localStorage.setItem('faraflick_viewed_profile_id', viewedProfileId);
      } else {
        localStorage.removeItem('faraflick_viewed_profile_id');
      }
      localStorage.setItem('faraflick_nav_history', JSON.stringify(history));
    } catch (err) {
      console.warn('[Navigation State] Failed to persist state:', err);
    }
  }, [activeTab, deepLinkedPeerId, deepLinkedGroupId, viewedProfileId, history]);

  // Synchronise state changes automatically to track history
  useEffect(() => {
    if (isBackNavigating.current) {
      isBackNavigating.current = false;
      return;
    }

    // Build standard reactive snapshot
    const currentState: NavigationState = {
      tab: activeTab,
      chatPeerId: deepLinkedPeerId,
      chatGroupId: deepLinkedGroupId,
      profileId: viewedProfileId,
    };

    // Whenever we select an active chat or group, ensure the intermediate 'chat' listing tab exists in history
    if ((deepLinkedPeerId || deepLinkedGroupId) && activeTab === 'chat') {
      setHistory((prev) => {
        const hasHome = prev.some(s => s.tab === 'home' && !s.chatPeerId && !s.chatGroupId);
        const hasChatList = prev.some(s => s.tab === 'chat' && !s.chatPeerId && !s.chatGroupId);
        
        const nextStack = [...prev];
        if (!hasHome) {
          nextStack.push({ tab: 'home', chatPeerId: null, chatGroupId: null, profileId: null });
        }
        if (!hasChatList) {
          nextStack.push({ tab: 'chat', chatPeerId: null, chatGroupId: null, profileId: null });
        }
        return nextStack;
      });
    }

    // Push previous state before entering viewed profile
    if (viewedProfileId) {
      pushToHistory({
        tab: activeTab,
        chatPeerId: deepLinkedPeerId,
        chatGroupId: deepLinkedGroupId,
        profileId: null
      });
    }
  }, [activeTab, deepLinkedPeerId, deepLinkedGroupId, viewedProfileId]);

  // Unified Go Back logic (React Navigation Layer)
  const goBack = (): boolean => {
    // 1. If profile view is open, close it first
    if (viewedProfileId) {
      console.log('[Back Button] Closing viewed profile modal:', viewedProfileId);
      setLocalViewedProfileId(null);
      return true;
    }

    // 2. If open inside a specific direct chat, clear it to return to Chat list
    if (deepLinkedPeerId) {
      console.log('[Back Button] Closing active peer conversation:', deepLinkedPeerId);
      setLocalDeepLinkedPeerId(null);
      return true;
    }

    // 3. If open inside a group chat, clear it
    if (deepLinkedGroupId) {
      console.log('[Back Button] Closing active group conversation:', deepLinkedGroupId);
      setLocalDeepLinkedGroupId(null);
      return true;
    }

    // 4. Pop from history stack
    if (history.length > 0) {
      const nextHistory = [...history];
      const previousState = nextHistory.pop()!;
      
      console.log('[Back Button] Navigating back to previous state:', previousState);
      isBackNavigating.current = true;
      setHistory(nextHistory);
      setLocalActiveTab(previousState.tab);
      setLocalDeepLinkedPeerId(previousState.chatPeerId);
      setLocalDeepLinkedGroupId(previousState.chatGroupId);
      setLocalViewedProfileId(previousState.profileId);
      return true;
    }

    // 5. If we are on home tab and stack is empty, return false (will trigger exit check)
    if (activeTab === 'home') {
      return false;
    }

    // 6. Otherwise return to Home tab as a safe fallback
    console.log('[Back Button] Falling back to home tab');
    setLocalActiveTab('home');
    return true;
  };

  const clearHistory = () => setHistory([]);

  // Wrapped states setters to sync with history perfectly
  const setActiveTab = (tab: 'home' | 'match' | 'chat' | 'news' | 'profile') => {
    if (tab !== activeTab) {
      pushToHistory({
        tab: activeTab,
        chatPeerId: deepLinkedPeerId,
        chatGroupId: deepLinkedGroupId,
        profileId: viewedProfileId
      });
    }
    setLocalActiveTab(tab);
  };

  const setDeepLinkedPeerId = (id: string | null) => {
    if (id !== deepLinkedPeerId) {
      pushToHistory({
        tab: activeTab,
        chatPeerId: deepLinkedPeerId,
        chatGroupId: deepLinkedGroupId,
        profileId: viewedProfileId
      });
    }
    setLocalDeepLinkedPeerId(id);
  };

  const setDeepLinkedGroupId = (id: string | null) => {
    if (id !== deepLinkedGroupId) {
      pushToHistory({
        tab: activeTab,
        chatPeerId: deepLinkedPeerId,
        chatGroupId: deepLinkedGroupId,
        profileId: viewedProfileId
      });
    }
    setLocalDeepLinkedGroupId(id);
  };

  const setViewedProfileId = (id: string | null) => {
    if (id !== viewedProfileId) {
      pushToHistory({
        tab: activeTab,
        chatPeerId: deepLinkedPeerId,
        chatGroupId: deepLinkedGroupId,
        profileId: viewedProfileId
      });
    }
    setLocalViewedProfileId(id);
  };

  return (
    <NavigationContext.Provider
      value={{
        activeTab,
        setActiveTab,
        deepLinkedPeerId,
        setDeepLinkedPeerId,
        deepLinkedGroupId,
        setDeepLinkedGroupId,
        viewedProfileId,
        setViewedProfileId,
        isSettingsOpen,
        setIsSettingsOpen,
        isFeedbackOpen,
        setIsFeedbackOpen,
        isShortcutsOpen,
        setIsShortcutsOpen,
        isMobileMenuOpen,
        setIsMobileMenuOpen,
        showOnboarding,
        setShowOnboarding,
        isTourOpen,
        setIsTourOpen,
        showNotifDropdown,
        setShowNotifDropdown,
        isChatScreenOpen,
        setIsChatScreenOpen,
        pushToHistory,
        goBack,
        clearHistory,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};
