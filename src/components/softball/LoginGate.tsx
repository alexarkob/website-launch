import { useEffect, useState, type FormEvent } from "react";
import type { TeamPublic } from "../../lib/softball/types";
import { createTeam, listTeams, login } from "./api";

interface Props {
  onAuthed: () => void;
}

export function LoginGate({ onAuthed }: Props) {
  const year = String(new Date().getFullYear());
  const [teams, setTeams] = useState<TeamPublic[]>([]);
  const [teamId, setTeamId] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [season, setSeason] = useState(year);
  const [newPassword, setNewPassword] = useState("");
  const [adminPin, setAdminPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listTeams()
      .then((list) => {
        setTeams(list);
        if (list[0]) setTeamId(list[0].id);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not load teams.");
      });
  }, []);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(teamId, password);
      onAuthed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createTeam({ name, season, password: newPassword, adminPin });
      onAuthed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create team.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sb-gate">
      <form className="sb-card" onSubmit={handleLogin}>
        <h2>Team login</h2>
        <p className="sb-lede">Everyone on the team shares one password.</p>
        {teams.length === 0 ? (
          <p className="sb-muted">No teams yet. Create one with the admin PIN.</p>
        ) : (
          <>
            <label className="sb-label">
              Team
              <select value={teamId} onChange={(e) => setTeamId(e.target.value)} required>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name} ({team.season})
                  </option>
                ))}
              </select>
            </label>
            <label className="sb-label">
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <button className="sb-btn sb-btn--primary" type="submit" disabled={busy || !teamId}>
              Enter
            </button>
          </>
        )}
      </form>

      <form className="sb-card" onSubmit={handleCreate}>
        <button
          type="button"
          className="sb-linkish"
          onClick={() => setCreating((v) => !v)}
        >
          {creating ? "Hide new team" : "Create a team (admin)"}
        </button>
        {creating && (
          <>
            <label className="sb-label">
              Team name
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="sb-label">
              Season
              <input value={season} onChange={(e) => setSeason(e.target.value)} required />
            </label>
            <label className="sb-label">
              Team password
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={6}
                required
              />
            </label>
            <label className="sb-label">
              Admin PIN
              <input
                type="password"
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value)}
                required
              />
            </label>
            <button className="sb-btn sb-btn--primary" type="submit" disabled={busy}>
              Create and enter
            </button>
          </>
        )}
      </form>

      {error && <p className="sb-banner sb-banner--warn">{error}</p>}
    </div>
  );
}
