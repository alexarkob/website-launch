import { useEffect, useRef, useState } from "react";
import type { WalkUpSong } from "../../lib/softball/types";
import { searchSongs } from "./api";

interface Props {
  song: WalkUpSong | null;
  onChange: (song: WalkUpSong | null) => void;
  compact?: boolean;
}

export function SongPicker({ song, onChange, compact = false }: Props) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<WalkUpSong[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setHits([]);
      return;
    }
    const handle = window.setTimeout(async () => {
      setBusy(true);
      setError(null);
      try {
        const tracks = await searchSongs(query.trim());
        setHits(
          tracks.map((track) => ({
            spotifyId: track.id,
            name: track.name,
            artists: track.artists,
            uri: track.uri,
            albumArt: track.albumArt,
          })),
        );
        setOpen(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed.");
        setHits([]);
      } finally {
        setBusy(false);
      }
    }, 300);
    return () => window.clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (song) {
    return (
      <div className={`sb-song sb-song--picked${compact ? " is-compact" : ""}`}>
        {song.albumArt && <img src={song.albumArt} alt="" />}
        <div>
          <strong>{song.name}</strong>
          {!compact && <span>{song.artists}</span>}
        </div>
        <button type="button" className="sb-btn sb-btn--ghost" onClick={() => onChange(null)}>
          Clear
        </button>
      </div>
    );
  }

  return (
    <div className={`sb-song-picker${compact ? " is-compact" : ""}`} ref={boxRef}>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => hits.length > 0 && setOpen(true)}
        placeholder="Search Spotify"
        aria-label="Search walk-up song"
      />
      {busy && <p className="sb-muted">Searching…</p>}
      {error && <p className="sb-tiny-warn">{error}</p>}
      {open && hits.length > 0 && (
        <ul className="sb-song-hits">
          {hits.map((hit) => (
            <li key={hit.spotifyId}>
              <button
                type="button"
                onClick={() => {
                  onChange(hit);
                  setQuery("");
                  setHits([]);
                  setOpen(false);
                }}
              >
                {hit.albumArt && <img src={hit.albumArt} alt="" />}
                <span>
                  <strong>{hit.name}</strong>
                  {hit.artists}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
