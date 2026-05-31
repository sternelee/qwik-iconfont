export interface AIUserSettings {
  apiKey: string;
  baseUrl: string;
  model: string;
}

const STORAGE_KEY = "qwik-iconfont:ai-settings";

export function getAIUserSettings(): AIUserSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { apiKey: "", baseUrl: "", model: "", ...JSON.parse(raw) };
    }
  } catch {
    // ignore parse/access errors
  }
  return { apiKey: "", baseUrl: "", model: "" };
}

export function saveAIUserSettings(settings: AIUserSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage errors
  }
}

export function clearAIUserSettings(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
