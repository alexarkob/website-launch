import { buildAdpBundle } from "../../src/lib/fetchAdpBundle";

export const onRequest = async () => {
  try {
    const payload = await buildAdpBundle();
    return Response.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 502 });
  }
};
