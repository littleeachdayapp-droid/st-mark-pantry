export interface PantrySettings {
  inventoryEnabled: boolean;
}

export const DEFAULT_SETTINGS: PantrySettings = {
  inventoryEnabled: false,
};

const STORAGE_KEY = 'pantry-settings';

export function loadSettings(): PantrySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {
    // ignore corrupt data
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: PantrySettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
