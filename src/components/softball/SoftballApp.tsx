import { useEffect, useMemo, useRef, useState } from "react";
import { newPlayer, syncAttendance } from "../../lib/softball/attendance";
import { generateBattingOrder } from "../../lib/softball/batting";
import { generateFielding } from "../../lib/softball/fielding";
import type { TeamPublic, TeamState } from "../../lib/softball/types";
import { BattingOrder } from "./BattingOrder";
import { FieldingLineups } from "./FieldingLineups";
import { LoginGate } from "./LoginGate";
import { RosterTable } from "./RosterTable";
import { loadState, logout, saveState, verifyAdminPin } from "./api";

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
  const skipSave = useRef(true);
  const adminPinRef = useRef<string | null>(null);
  const [canEditIdeal, setCanEditIdeal] = useState(false);

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
      saveState(state, adminPinRef.current ?? undefined)
        .then(() => {
          setSaveLabel("Saved");
          if (state.idealBattingLocked) {
            adminPinRef.current = null;
            setCanEditIdeal(false);
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

  function handleGenerateBatting() {
    patchState((prev) => ({
      ...prev,
      battingOrder: generateBattingOrder(prev.roster, prev.idealBattingOrder),
      needsRegen: false,
    }));
  }

  function handleGenerateFielding() {
    if (!state) return;
    const result = generateFielding(state.roster);
    setFieldingNotes(result.warnings);
    patchState((prev) => ({ ...prev, innings: result.innings, needsRegen: false }));
  }

  function handleRegenBoth() {
    if (!state) return;
    const result = generateFielding(state.roster);
    setFieldingNotes(result.warnings);
    patchState((prev) => ({
      ...prev,
      battingOrder: generateBattingOrder(prev.roster, prev.idealBattingOrder),
      innings: result.innings,
      needsRegen: false,
    }));
  }

  async function handleLogout() {
    await logout();
    setTeam(null);
    setState(null);
    skipSave.current = true;
    adminPinRef.current = null;
    setCanEditIdeal(false);
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
              onWeekChange={(battingOrder) => patchState((prev) => ({ ...prev, battingOrder }))}
              onGenerate={handleGenerateBatting}
              onUnlock={async (adminPin) => {
                await verifyAdminPin(adminPin);
                adminPinRef.current = adminPin;
                setCanEditIdeal(true);
                patchState((prev) => ({ ...prev, idealBattingLocked: false }));
              }}
              onLock={() => patchState((prev) => ({ ...prev, idealBattingLocked: true }))}
            />
          )}
          {tab === "fielding" && (
            <FieldingLineups
              state={state}
              onInningsChange={(innings) => patchState((prev) => ({ ...prev, innings }))}
              onGenerate={handleGenerateFielding}
              generateWarnings={fieldingNotes}
            />
          )}
        </>
      )}
    </div>
  );
}
