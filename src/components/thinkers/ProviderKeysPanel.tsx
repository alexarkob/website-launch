import { useEffect, useState, type FormEvent } from "react";
import {
  PROVIDERS,
  type ModelProviderId,
  type ProviderSecretKey,
} from "../../lib/thinkers/providers/catalog";
import type { StoredProviderKeys } from "./useProviderKeys";

type Props = {
  provider: ModelProviderId;
  keys: StoredProviderKeys;
  onSave: (next: StoredProviderKeys) => void;
  onClearProvider: (fields: ProviderSecretKey[]) => void;
};

export function ProviderKeysPanel({
  provider,
  keys,
  onSave,
  onClearProvider,
}: Props) {
  const info = PROVIDERS[provider];
  const [draft, setDraft] = useState<StoredProviderKeys>({});
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    const next: StoredProviderKeys = {};
    for (const field of info.envKeys) {
      next[field] = keys[field] ?? "";
    }
    setDraft(next);
    setSavedFlash(false);
  }, [provider, keys, info.envKeys]);

  const allPresent = info.envKeys.every((field) => Boolean(keys[field]?.trim()));

  function handleSave(e: FormEvent) {
    e.preventDefault();
    const merged: StoredProviderKeys = { ...keys };
    for (const field of info.envKeys) {
      const value = draft[field]?.trim();
      if (value) merged[field] = value;
      else delete merged[field];
    }
    onSave(merged);
    setSavedFlash(true);
  }

  return (
    <form className="provider-keys" onSubmit={handleSave}>
      <div className="provider-keys__header">
        <h3 className="provider-keys__title">API keys for {info.label}</h3>
        <p className="provider-keys__status">
          {allPresent
            ? "Key saved in this browser"
            : "No key saved yet for this provider"}
        </p>
      </div>

      {info.envKeys.map((field) => (
        <label key={field} className="provider-keys__field">
          <span className="thinker-label">
            {info.fieldLabels[field] ?? field}
          </span>
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            className="provider-keys__input"
            value={draft[field] ?? ""}
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, [field]: e.target.value }))
            }
            placeholder={`Paste ${info.fieldLabels[field] ?? field}`}
          />
        </label>
      ))}

      <div className="provider-keys__actions">
        <button type="submit" className="thinker-btn thinker-btn--primary">
          Save in this browser
        </button>
        <button
          type="button"
          className="thinker-btn thinker-btn--ghost"
          onClick={() => onClearProvider(info.envKeys)}
        >
          Clear {info.label} keys
        </button>
      </div>

      {savedFlash && (
        <p className="provider-keys__saved" role="status">
          Saved. Keys stay in this browser only.
        </p>
      )}
    </form>
  );
}
