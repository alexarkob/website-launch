import { useEffect, useMemo, useRef, useState } from "react";
import { newPlayer, syncAttendance } from "../../lib/softball/attendance";
import { ensureWeekOrder, generateBattingOrder } from "../../lib/softball/batting";
import type { TeamPublic, TeamState } from "../../lib/softball/types";
import { BattingOrder } from "./BattingOrder";
import { FieldingLineups } from "./FieldingLineups";
import { LoginGate } from "./LoginGate";
import { RosterTable } from "./RosterTable";
import { generateFieldingLineups, loadState, logout, saveState, verifyAdminPin } from "./api";

type Tab = "roster" | "batting" | "fielding";

function hasLineups(state: TeamState): boolean {
  return (
    state.battingOrder.length > 0 ||
    state.innings.some((inning) => Object.values(inning.defense).some(Boolean))
  );
}

export default function SoftballApp() {
  const [ready, setReady] = useState(false);
  const [team, setTeam] = useState<TeamPublic | null>(null);
  const [state, setState] = useState<TeamState | null>(null);
  const [tab, setTab] = useState<Tab>("roster");
  const [error, setError] = useState<string | null>(null);
  const [saveLabel, setSaveLabel] = useState("Saved");
  const [fieldingNotes, setFieldingNotes] = useState<string[]>([]);
  const [fieldingLogicNotes, setFieldingLogicNotes] = useState("");
  const fieldingLogicNotesRef = useRef("");
  const skipSave = useRef(true);
  const adminPinRef = useRef<string | null>(null);
  const [canEditIdeal, setCanEditIdeal] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesLocking, setNotesLocking] = useState(false);
  const [notesSubmitted, setNotesSubmitted] = useState(false);

  async function hydrate() {
    setError(null);
    try {
      const payload = await loadState();
      skipSave.current = true;
      if (payload) {
        setTeam(payload.team);
        setState(payload.state);
      } else {
        setTeam(null);
        setState(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load team.");
    } finally {
      setReady(true);
    }
  }

  useEffect(() => {
    void hydrate();
  }, []);

  useEffect(() => {
    if (!team || !state) return;
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    setSaveLabel("Saving…");
    const timer = window.setTimeout(() => {
      const adminPin = adminPinRef.current ?? undefined;
      saveState(state, {
        adminPin,
        fieldingLogicNotes: adminPin ? fieldingLogicNotesRef.current : undefined,
      })
        .then(() => {
          setSaveLabel("Saved");
          if (state.idealBattingLocked) {
            adminPinRef.current = null;
            setCanEditIdeal(false);
            fieldingLogicNotesRef.current = "";
            setFieldingLogicNotes("");
            setNotesOpen(false);
          }
        })
        .catch((err: unknown) => {
          setSaveLabel("Save failed");
          setError(err instanceof Error ? err.message : "Save failed.");
        });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [state, team]);

  const presentCount = useMemo(
    () => state?.roster.filter((player) => player.present).length ?? 0,
    [state],
  );

  function patchState(updater: (prev: TeamState) => TeamState) {
    setState((prev) => (prev ? updater(prev) : prev));
  }

  function handleRoster(roster: TeamState["roster"]) {
    patchState((prev) => syncAttendance(prev, roster));
  }

  async function generateDefense(roster: TeamState["roster"]) {
    const adminPin = adminPinRef.current ?? undefined;
    return generateFieldingLineups(
      roster,
      adminPin ? { adminPin, fieldingLogicNotes: fieldingLogicNotesRef.current } : undefined,
    );
  }

  async function persistNotes(notes: string) {
    const adminPin = adminPinRef.current;
    if (!state || !adminPin) {
      throw new Error("Unlock with the admin PIN first.");
    }
    setSaveLabel("Saving…");
    fieldingLogicNotesRef.current = notes;
    await saveState(state, { adminPin, fieldingLogicNotes: notes });
    setSaveLabel("Saved");
  }

  async function handleSaveNotes(notes: string) {
    try {
      await persistNotes(notes);
      setFieldingLogicNotes(notes);
    } catch (err) {
      setSaveLabel("Save failed");
      setError(err instanceof Error ? err.message : "Could not save notes.");
      throw err;
    }
  }

  async function handleLockNotes(notes: string) {
    setNotesLocking(true);
    try {
      await persistNotes(notes);
      setFieldingLogicNotes("");
      setNotesOpen(false);
      setNotesSubmitted(true);
    } catch (err) {
      setSaveLabel("Save failed");
      setError(err instanceof Error ? err.message : "Could not lock notes.");
      throw err;
    } finally {
      setNotesLocking(false);
    }
  }

  async function handleAdminUnlock(adminPin: string) {
    const unlocked = await verifyAdminPin(adminPin);
    adminPinRef.current = adminPin;
    skipSave.current = true;
    fieldingLogicNotesRef.current = unlocked.fieldingLogicNotes;
    setFieldingLogicNotes(unlocked.fieldingLogicNotes);
    setNotesOpen(true);
    setNotesSubmitted(false);
    setCanEditIdeal(true);
    patchState((prev) => ({ ...prev, idealBattingLocked: false }));
  }

  function handleGenerateBatting() {
    patchState((prev) => ({
      ...prev,
      battingOrder: generateBattingOrder(prev.roster, prev.idealBattingOrder),
      needsRegen: false,
    }));
  }

  async function handleGenerateFielding() {
    if (!state) return;
    try {
      const result = await generateDefense(state.roster);
      setFieldingNotes([...result.warnings, ...(result.noteWarnings ?? [])]);
      patchState((prev) => ({ ...prev, innings: result.innings, needsRegen: false }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate fielding.");
    }
  }

  async function handleRegenBoth() {
    if (!state) return;
    try {
      const result = await generateDefense(state.roster);
      setFieldingNotes([...result.warnings, ...(result.noteWarnings ?? [])]);
      patchState((prev) => ({
        ...prev,
        battingOrder: generateBattingOrder(prev.roster, prev.idealBattingOrder),
        innings: result.innings,
        needsRegen: false,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate lineups.");
    }
  }

  async function handleLogout() {
    await logout();
    setTeam(null);
    setState(null);
    skipSave.current = true;
    adminPinRef.current = null;
    setCanEditIdeal(false);
    setFieldingLogicNotes("");
    fieldingLogicNotesRef.current = "";
    setNotesOpen(false);
    setNotesSubmitted(false);
  }

  if (!ready) {
    return (
      <div className="sb-app">
        <p className="sb-loading">Loading…</p>
      </div>
    );
  }

  return (
    <div className={`sb-app${team && state ? " sb-app--in" : ""}`}>
      <header className="sb-hero">
        <p className="sb-hero__eyebrow">
          <a href="/">← Portfolio</a>
        </p>
        <h1>Lineup</h1>
        <p className="sb-hero__lede">
          Coed slowpitch helper: roster, 3-and-1 batting order, and a 6-inning
          10-player defense.
        </p>
        {team && (
          <div className="sb-hero__meta">
            <strong>{team.name}</strong>
            <span>{team.season}</span>
            <span className="sb-save">{saveLabel}</span>
            <button type="button" className="sb-btn sb-btn--ghost" onClick={() => void handleLogout()}>
              Log out
            </button>
          </div>
        )}
      </header>

      {error && <p className="sb-banner sb-banner--warn">{error}</p>}

      {!team || !state ? (
        <LoginGate onAuthed={() => void hydrate()} />
      ) : (
        <>
          {state.needsRegen && hasLineups(state) && (
            <div className="sb-banner sb-banner--warn sb-banner--row">
              <span>Attendance changed. Regenerate batting and fielding for this week?</span>
              <button type="button" className="sb-btn" onClick={handleRegenBoth}>
                Regenerate for this week’s attendance
              </button>
            </div>
          )}
          <nav className="sb-tabs" aria-label="Lineup sections">
            {(
              [
                ["roster", `Roster (${presentCount} present)`],
                ["batting", "Batting"],
                ["fielding", "Fielding"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={tab === id ? "is-active" : ""}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </nav>
          {tab === "roster" && (
            <RosterTable
              roster={state.roster}
              onChange={handleRoster}
              onAdd={() => handleRoster([...state.roster, newPlayer()])}
            />
          )}
          {tab === "batting" && (
            <BattingOrder
              state={state}
              canEditIdeal={canEditIdeal}
              onIdealChange={(idealBattingOrder) =>
                patchState((prev) => ({ ...prev, idealBattingOrder }))
              }
              onWeekChange={(battingOrder) =>
                patchState((prev) => ({
                  ...prev,
                  battingOrder: ensureWeekOrder(prev.roster, battingOrder),
                }))
              }
              onGenerate={handleGenerateBatting}
              onUnlock={handleAdminUnlock}
              onLock={() => patchState((prev) => ({ ...prev, idealBattingLocked: true }))}
            />
          )}
          {tab === "fielding" && (
            <FieldingLineups
              state={state}
              notesOpen={notesOpen}
              fieldingLogicNotes={fieldingLogicNotes}
              notesLocking={notesLocking}
              notesSubmitted={notesSubmitted}
              onSaveNotes={handleSaveNotes}
              onLockNotes={handleLockNotes}
              onUnlock={handleAdminUnlock}
              onInningsChange={(innings) => patchState((prev) => ({ ...prev, innings }))}
              onGenerate={() => void handleGenerateFielding()}
              generateWarnings={fieldingNotes}
            />
          )}
        </>
      )}
    </div>
  );
}
