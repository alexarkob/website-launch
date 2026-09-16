import MiniSearch from "minisearch";
import { getThinkerChunks } from "./corpus";
// Server-only: chunks + MiniSearch must not ship to the client island.
import type { ThinkerChunk, ThinkerId } from "./types";

type IndexedChunk = ThinkerChunk & { thinkerId: ThinkerId };

const indexes = new Map<ThinkerId, MiniSearch<IndexedChunk>>();

function getIndex(thinkerId: ThinkerId): MiniSearch<IndexedChunk> {
  const existing = indexes.get(thinkerId);
  if (existing) return existing;

  const mini = new MiniSearch<IndexedChunk>({
    fields: ["title", "text"],
    storeFields: ["id", "title", "url", "date", "text", "thinkerId"],
    searchOptions: {
      boost: { title: 2 },
      fuzzy: 0.2,
      prefix: true,
    },
  });

  const docs = getThinkerChunks(thinkerId).map((chunk) => ({
    ...chunk,
    thinkerId,
  }));
  mini.addAll(docs);
  indexes.set(thinkerId, mini);
  return mini;
}

export type RetrievedChunk = {
  id: string;
  title: string;
  url?: string;
  date?: string;
  text: string;
  score: number;
};

/**
 * Retrieve top-k public corpus chunks for a thinker given a free-text query.
 * Falls back to the first chunks if the query is empty or yields no hits.
 */
export function retrieveChunks(
  thinkerId: ThinkerId,
  query: string,
  topK = 5,
): RetrievedChunk[] {
  const chunks = getThinkerChunks(thinkerId);
  const cleaned = query.trim().replace(/\s+/g, " ").slice(0, 2000);

  if (!cleaned) {
    return chunks.slice(0, topK).map((c, i) => ({
      id: c.id,
      title: c.title,
      url: c.url,
      date: c.date,
      text: c.text,
      score: topK - i,
    }));
  }

  const results = getIndex(thinkerId).search(cleaned);
  if (results.length === 0) {
    return chunks.slice(0, topK).map((c, i) => ({
      id: c.id,
      title: c.title,
      url: c.url,
      date: c.date,
      text: c.text,
      score: topK - i,
    }));
  }

  return results.slice(0, topK).map((hit) => {
    const chunk = chunks.find((c) => c.id === hit.id) ?? {
      id: String(hit.id),
      title: String(hit.title ?? "Untitled"),
      url: hit.url as string | undefined,
      date: hit.date as string | undefined,
      text: String(hit.text ?? ""),
    };
    return {
      id: chunk.id,
      title: chunk.title,
      url: chunk.url,
      date: chunk.date,
      text: chunk.text,
      score: hit.score,
    };
  });
}
