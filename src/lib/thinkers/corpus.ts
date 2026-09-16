import benChunks from "../../content/thinkers/ben-thompson/chunks.json";
import benedictChunks from "../../content/thinkers/benedict-evans/chunks.json";
import packyChunks from "../../content/thinkers/packy-mccormick/chunks.json";
import type { ThinkerChunk, ThinkerId } from "./types";

const chunksByThinker: Record<ThinkerId, ThinkerChunk[]> = {
  "packy-mccormick": packyChunks as ThinkerChunk[],
  "ben-thompson": benChunks as ThinkerChunk[],
  "benedict-evans": benedictChunks as ThinkerChunk[],
};

export function getThinkerChunks(id: ThinkerId): ThinkerChunk[] {
  return chunksByThinker[id];
}
