import { type FormEvent, useState } from "react";

export function UnlockForm({
  onUnlock,
  inputId = "sb-admin-pin",
}: {
  onUnlock: (adminPin: string) => Promise<void>;
  inputId?: string;
}) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onUnlock(pin);
      setPin("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not unlock.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="sb-unlock" onSubmit={(event) => void handleSubmit(event)}>
      <label className="sb-sr" htmlFor={inputId}>
        Admin PIN
      </label>
      <input
        id={inputId}
        type="password"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        placeholder="Admin PIN"
        autoComplete="off"
        required
      />
      <button type="submit" className="sb-btn" disabled={busy || !pin}>
        Unlock
      </button>
      {error && <p className="sb-tiny-warn">{error}</p>}
    </form>
  );
}
