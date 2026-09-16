import { useMemo, useState } from "react";
import {
  DEFAULT_PROVIDER,
  listProviders,
  PROVIDERS,
  type ModelProviderId,
} from "../../lib/thinkers/providers/catalog";
import { listThinkerProfiles } from "../../lib/thinkers/profiles";
import { AgentPanel } from "./AgentPanel";
import { ProviderKeysPanel } from "./ProviderKeysPanel";
import { useProviderKeys } from "./useProviderKeys";

export default function ThinkersApp() {
  const profiles = listThinkerProfiles();
  const providers = useMemo(() => listProviders(), []);
  const [provider, setProvider] = useState<ModelProviderId>(DEFAULT_PROVIDER);
  const selected = PROVIDERS[provider];
  const { keys, saveKeys, clearProviderFields } = useProviderKeys();

  return (
    <div className="thinkers-app">
      <header className="thinkers-hero">
        <p className="thinkers-hero__eyebrow">
          <a href="/">← Portfolio</a>
        </p>
        <h1 className="thinkers-hero__title">Thinkers</h1>
        <p className="thinkers-hero__lede">
          Content-grounded reactions from three public tech voices. Paste text
          or attach files; each agent replies in that thinker’s style at the
          length you choose.
        </p>

        <fieldset className="provider-toggle">
          <legend className="thinker-label">Model provider</legend>
          <div className="provider-toggle__options" role="radiogroup">
            {providers.map((p) => (
              <label
                key={p.id}
                className={`provider-toggle__option${provider === p.id ? " is-active" : ""}`}
              >
                <input
                  type="radio"
                  name="thinkers-provider"
                  value={p.id}
                  checked={provider === p.id}
                  onChange={() => setProvider(p.id)}
                />
                <span className="provider-toggle__name">{p.label}</span>
                <span
                  className={`provider-toggle__badge provider-toggle__badge--${p.cost}`}
                >
                  {p.costBadge}
                </span>
              </label>
            ))}
          </div>
          <p className="provider-toggle__note">
            <strong>{selected.label}</strong> ({selected.model}):{" "}
            {selected.costNote}
          </p>
        </fieldset>
      </header>

      <section className="thinkers-guide" aria-labelledby="thinkers-guide-title">
        <h2 id="thinkers-guide-title" className="thinkers-guide__title">
          How to get started
        </h2>

        <div className="thinkers-guide__block">
          <h3 className="thinkers-guide__step">1. Why you need a key</h3>
          <p>
            This demo does not bill the site owner for model usage. Each visitor
            brings their own provider key so reactions run on{" "}
            <em>your</em> free tier or paid account — not ours.
          </p>
        </div>

        <div className="thinkers-guide__block">
          <h3 className="thinkers-guide__step">2. Pick a model</h3>
          <p className="thinkers-guide__hint">
            Gemini Flash is recommended to start (free-tier key). Use the toggle
            above to choose which model runs reactions. Setup for every provider
            is below.
          </p>
          <ul className="thinkers-recs">
            {providers.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={`thinkers-recs__item${provider === p.id ? " is-active" : ""}`}
                  onClick={() => setProvider(p.id)}
                >
                  <div className="thinkers-recs__top">
                    <strong>{p.label}</strong>
                    <span
                      className={`provider-toggle__badge provider-toggle__badge--${p.cost}`}
                    >
                      {p.costBadge}
                    </span>
                  </div>
                  <p>{p.whenToUse}</p>
                  {p.id === "gemini" && (
                    <p className="thinkers-recs__tag">Recommended to start</p>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="thinkers-guide__block" id="api-keys">
          <h3 className="thinkers-guide__step">3. Add your keys</h3>
          <p className="thinkers-guide__hint">
            Save credentials for any providers you want to use. Only the key for
            the model selected above is sent with each reaction.
          </p>

          <div className="thinkers-key-setups">
            {providers.map((p) => (
              <article
                key={p.id}
                className={`thinkers-key-setup${provider === p.id ? " is-active" : ""}`}
                id={`api-keys-${p.id}`}
              >
                <header className="thinkers-key-setup__header">
                  <div className="thinkers-recs__top">
                    <h4 className="thinkers-key-setup__title">{p.label}</h4>
                    <span
                      className={`provider-toggle__badge provider-toggle__badge--${p.cost}`}
                    >
                      {p.costBadge}
                    </span>
                  </div>
                  <p className="thinkers-key-setup__why">{p.whyNeeded}</p>
                </header>

                <ol className="thinkers-guide__steps">
                  {p.setupSteps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>

                <p className="thinkers-guide__link">
                  <a href={p.signupUrl} target="_blank" rel="noreferrer">
                    Open {p.label} signup / key page →
                  </a>
                </p>

                <ProviderKeysPanel
                  provider={p.id}
                  keys={keys}
                  onSave={saveKeys}
                  onClearProvider={clearProviderFields}
                />

                <button
                  type="button"
                  className="thinker-btn thinker-btn--ghost thinkers-key-setup__use"
                  onClick={() => setProvider(p.id)}
                >
                  {provider === p.id
                    ? `Using ${p.label} for reactions`
                    : `Use ${p.label} for reactions`}
                </button>
              </article>
            ))}
          </div>
        </div>

        <div className="thinkers-guide__block">
          <h3 className="thinkers-guide__step">4. Privacy</h3>
          <p>
            Keys stay in this browser’s local storage. They are sent only to this
            site’s reaction API so it can call the model for your request, and
            are not stored on the server.
          </p>
        </div>
      </section>

      <div className="thinkers-grid">
        {profiles.map((profile) => (
          <AgentPanel
            key={profile.id}
            profile={profile}
            provider={provider}
            providerKeys={keys}
          />
        ))}
      </div>

      <footer className="thinkers-footer">
        <p>
          Simulated personas grounded in curated public frameworks — not the
          real authors, and not paywalled newsletter text. Bring your own API
          key; usage is charged to you (or stays within your free tier).
        </p>
        <ul className="thinkers-footer__costs">
          {providers.map((p) => (
            <li key={p.id}>
              <strong>{p.label}</strong> — {p.costBadge}: {p.whenToUse}{" "}
              {p.costNote}
            </li>
          ))}
        </ul>
      </footer>
    </div>
  );
}
