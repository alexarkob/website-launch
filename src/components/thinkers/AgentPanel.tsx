import { useId, useRef, useState, type FormEvent } from "react";
import {
  keysForProvider,
  missingProviderFields,
  PROVIDERS,
  type ModelProviderId,
} from "../../lib/thinkers/providers/catalog";
import type {
  ReactionLength,
  ReactResponseBody,
  ThinkerId,
  ThinkerProfile,
} from "../../lib/thinkers/types";
import { extractFiles, type ExtractedImage } from "./extractFiles";
import type { StoredProviderKeys } from "./useProviderKeys";

const LENGTH_LABELS: Record<ReactionLength, string> = {
  short: "Short",
  medium: "Medium",
  long: "Long",
};

type Props = {
  profile: ThinkerProfile;
  provider: ModelProviderId;
  providerKeys: StoredProviderKeys;
};

export function AgentPanel({ profile, provider, providerKeys }: Props) {
  const formId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [length, setLength] = useState<ReactionLength>("medium");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [result, setResult] = useState<ReactResponseBody | null>(null);

  function onFilesChosen(list: FileList | null) {
    if (!list?.length) return;
    setFiles((prev) => [...prev, ...Array.from(list)].slice(0, 8));
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setWarnings([]);

    try {
      const missing = missingProviderFields(provider, providerKeys);
      if (missing.length > 0) {
        const info = PROVIDERS[provider];
        throw new Error(
          `Add your ${info.label} key in the API keys section below, then try again.`,
        );
      }

      const extracted = await extractFiles(files);
      setWarnings(extracted.warnings);

      const images: ExtractedImage[] = extracted.images;
      const payload = {
        thinkerId: profile.id as ThinkerId,
        provider,
        length,
        text,
        keys: keysForProvider(provider, providerKeys),
        attachmentsText: extracted.attachmentsText || undefined,
        images: images.length
          ? images.map(({ mediaType, dataBase64 }) => ({
              mediaType,
              dataBase64,
            }))
          : undefined,
      };

      const res = await fetch("/api/thinkers/react", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as ReactResponseBody & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      setResult(data);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <article className="thinker-panel" data-thinker={profile.id}>
      <header className="thinker-panel__header">
        <h2 className="thinker-panel__name">{profile.displayName}</h2>
        <p className="thinker-panel__bio">{profile.bio}</p>
      </header>

      <form className="thinker-panel__form" onSubmit={onSubmit}>
        <label className="thinker-label" htmlFor={`${formId}-text`}>
          Prompt
        </label>
        <textarea
          id={`${formId}-text`}
          className="thinker-textarea"
          rows={5}
          placeholder="Paste a claim, product launch, or question…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={loading}
        />

        <div className="thinker-files">
          <input
            ref={fileRef}
            type="file"
            className="sr-only"
            multiple
            accept="image/*,.pdf,.pptx,.docx,.txt,.md,.csv,.json"
            onChange={(e) => {
              onFilesChosen(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            className="thinker-btn thinker-btn--ghost"
            onClick={() => fileRef.current?.click()}
            disabled={loading}
          >
            Attach files
          </button>
          <span className="thinker-hint">
            Images, PDF, PPTX, DOCX, text
          </span>
        </div>

        {files.length > 0 && (
          <ul className="thinker-file-list">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`}>
                <span>{f.name}</span>
                <button
                  type="button"
                  className="thinker-file-remove"
                  onClick={() => removeFile(i)}
                  disabled={loading}
                  aria-label={`Remove ${f.name}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <fieldset className="thinker-length" disabled={loading}>
          <legend className="thinker-label">Response length</legend>
          <div className="thinker-length__options" role="radiogroup">
            {(["short", "medium", "long"] as ReactionLength[]).map((opt) => (
              <label key={opt} className="thinker-length__option">
                <input
                  type="radio"
                  name={`${formId}-length`}
                  value={opt}
                  checked={length === opt}
                  onChange={() => setLength(opt)}
                />
                {LENGTH_LABELS[opt]}
              </label>
            ))}
          </div>
        </fieldset>

        <button
          type="submit"
          className="thinker-btn thinker-btn--primary"
          disabled={loading}
        >
          {loading ? "Thinking…" : "Get reaction"}
        </button>
      </form>

      {error && (
        <p className="thinker-error" role="alert">
          {error}
        </p>
      )}

      {warnings.length > 0 && (
        <ul className="thinker-warnings">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      {result && (
        <div className="thinker-result">
          <h3 className="thinker-result__label">
            Reaction
            {result.provider ? ` · ${result.provider}` : ""}
          </h3>
          <div className="thinker-result__body">{result.reaction}</div>
          {result.sourcesUsed.length > 0 && (
            <details className="thinker-sources">
              <summary>Grounding sources</summary>
              <ul>
                {result.sourcesUsed.map((s) => (
                  <li key={s.id}>
                    {s.url ? (
                      <a href={s.url} target="_blank" rel="noreferrer">
                        {s.title}
                      </a>
                    ) : (
                      s.title
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </article>
  );
}
