// src/hooks/usePreferences.ts
import { useState, useEffect, useCallback } from 'react';

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: 'en' | 'el' | 'es';
  autoSave: boolean;
  defaultSegmentMode: 'qa' | 'paragraphs';
  exportFormat: 'json' | 'csv' | 'txt' | 'md';
  itemsPerPage: number;
  showLineNumbers: boolean;
  autoSegment: boolean;
  notifications: {
    email: boolean;
    browser: boolean;
    sounds: boolean;
  };
  ui: {
    compactMode: boolean;
    showSidebar: boolean;
    sidebarWidth: number;
  };
}

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'system',
  language: 'en',
  autoSave: true,
  defaultSegmentMode: 'qa',
  exportFormat: 'json',
  itemsPerPage: 25,
  showLineNumbers: false,
  autoSegment: false,
  notifications: {
    email: true,
    browser: true,
    sounds: false
  },
  ui: {
    compactMode: false,
    showSidebar: true,
    sidebarWidth: 300
  }
};

const PREFERENCES_KEY = 'ai_organizer_preferences';

export function usePreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);

  // Load preferences from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PREFERENCES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setPreferences({ ...DEFAULT_PREFERENCES, ...parsed });
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save preferences to localStorage
  const savePreferences = useCallback((newPreferences: Partial<UserPreferences>) => {
    try {
      const updated = { ...preferences, ...newPreferences };
      setPreferences(updated);
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
  }, [preferences]);

  // Reset to defaults
  const resetPreferences = useCallback(() => {
    try {
      setPreferences(DEFAULT_PREFERENCES);
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(DEFAULT_PREFERENCES));
    } catch (error) {
      console.error('Failed to reset preferences:', error);
    }
  }, []);

  // Individual preference setters
  const updateTheme = useCallback((theme: UserPreferences['theme']) => {
    savePreferences({ theme });
  }, [savePreferences]);

  const updateLanguage = useCallback((language: UserPreferences['language']) => {
    savePreferences({ language });
  }, [savePreferences]);

  const updateDefaultSegmentMode = useCallback((mode: UserPreferences['defaultSegmentMode']) => {
    savePreferences({ defaultSegmentMode: mode });
  }, [savePreferences]);

  const updateExportFormat = useCallback((format: UserPreferences['exportFormat']) => {
    savePreferences({ exportFormat: format });
  }, [savePreferences]);

  const updateItemsPerPage = useCallback((itemsPerPage: UserPreferences['itemsPerPage']) => {
    savePreferences({ itemsPerPage });
  }, [savePreferences]);

  const updateNotifications = useCallback((notifications: Partial<UserPreferences['notifications']>) => {
    savePreferences({ notifications: { ...preferences.notifications, ...notifications } });
  }, [savePreferences, preferences.notifications]);

  const updateUI = useCallback((ui: Partial<UserPreferences['ui']>) => {
    savePreferences({ ui: { ...preferences.ui, ...ui } });
  }, [savePreferences, preferences.ui]);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    
    if (preferences.theme === 'dark') {
      root.classList.add('dark');
    } else if (preferences.theme === 'light') {
      root.classList.remove('dark');
    } else {
      // system preference
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      if (mediaQuery.matches) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, [preferences.theme]);

  return {
    preferences,
    isLoading,
    savePreferences,
    resetPreferences,
    
    // Individual setters
    updateTheme,
    updateLanguage,
    updateDefaultSegmentMode,
    updateExportFormat,
    updateItemsPerPage,
    updateNotifications,
    updateUI,
  };
}

// Preference validation
export function validatePreferences(prefs: Partial<UserPreferences>): string[] {
  const errors: string[] = [];

  if (prefs.itemsPerPage !== undefined && (prefs.itemsPerPage < 5 || prefs.itemsPerPage > 100)) {
    errors.push('Items per page must be between 5 and 100');
  }

  if (prefs.ui?.sidebarWidth !== undefined && (prefs.ui.sidebarWidth < 200 || prefs.ui.sidebarWidth > 500)) {
    errors.push('Sidebar width must be between 200 and 500 pixels');
  }

  return errors;
}

// Export preferences for easy access
export const PREFERENCE_CATEGORIES = {
  APPEARANCE: ['theme', 'language', 'ui.compactMode', 'ui.showSidebar'],
  BEHAVIOR: ['autoSave', 'autoSegment', 'defaultSegmentMode'],
  EXPORT: ['exportFormat', 'showLineNumbers'],
  NOTIFICATIONS: ['notifications.email', 'notifications.browser', 'notifications.sounds'],
  DISPLAY: ['itemsPerPage', 'ui.sidebarWidth']
} as const;
