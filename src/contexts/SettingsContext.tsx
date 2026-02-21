import { createContext, useContext, useState, useCallback } from 'react';
import {
  loadSettings,
  saveSettings,
  type PantrySettings,
} from '@/lib/settings';

interface SettingsContextValue {
  settings: PantrySettings;
  updateSettings: (patch: Partial<PantrySettings>) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<PantrySettings>(loadSettings);

  const updateSettings = useCallback((patch: Partial<PantrySettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return ctx;
}
