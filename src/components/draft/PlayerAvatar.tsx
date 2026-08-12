import { useState } from "react";
import type { Player } from "./types";

export function PlayerAvatar({ player, size = 36 }: { player: Player; size?: number }) {
  const [failed, setFailed] = useState(false);
  const initials = player.name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (!player.headshotUrl || failed) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-paper-deep text-[0.65rem] font-semibold text-muted"
        style={{ width: size, height: size }}
        aria-hidden
      >
        {initials}
      </span>
    );
  }

  return (
    <img
      src={player.headshotUrl}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      className="shrink-0 rounded-full object-cover bg-paper-deep"
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  );
}
