import { useCallback, useEffect, useState } from "react";
import type { ProviderSecretKey } from "../../lib/thinkers/providers/catalog";

const STORAGE_KEY = "thinkers.providerKeys.v1";

export type StoredProviderKeys = Partial<Record<ProviderSecretKey, string>>;

const EMPTY: StoredProviderKeys = {};

function readStorage(): StoredProviderKeys {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as StoredProviderKeys;
    if (!parsed || typeof parsed !== "object") return { ...EMPTY };
    const out: StoredProviderKeys = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string" && value.trim()) {
        out[key as ProviderSecretKey] = value.trim();
      }
    }
    return out;
  } catch {
    return { ...EMPTY };
  }
}

export function useProviderKeys() {
  const [keys, setKeys] = useState<StoredProviderKeys>({ ...EMPTY });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setKeys(readStorage());
    setHydrated(true);
  }, []);

  const saveKeys = useCallback((next: StoredProviderKeys) => {
    const cleaned: StoredProviderKeys = {};
    for (const [key, value] of Object.entries(next)) {
      if (typeof value === "string" && value.trim()) {
        cleaned[key as ProviderSecretKey] = value.trim();
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    setKeys(cleaned);
  }, []);

  const clearKeys = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setKeys({ ...EMPTY });
  }, []);

  const clearProviderFields = useCallback(
    (fields: ProviderSecretKey[]) => {
      const next = { ...keys };
      for (const field of fields) delete next[field];
      saveKeys(next);
    },
    [keys, saveKeys],
  );

  return { keys, hydrated, saveKeys, clearKeys, clearProviderFields };
}
