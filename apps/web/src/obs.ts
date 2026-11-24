// IDs compatíveis com o código de salas do Podcast (espelhado de room.ts).
const isRoomId = (room: string) => /^aulas-[0-9a-f]{24}$/.test(room);

/** Source URL supplied to OBS Browser Source; never publish as this viewer link. */
export function obsSoloUrl(room: string, streamId: string): string {
  if (!isRoomId(room)) throw new Error("Sala inválida.");
  if (typeof streamId !== "string" || !/^[a-zA-Z0-9_-]{3,64}$/.test(streamId)) {
    throw new Error("Identificador do vídeo inválido.");
  }
  const url = new URL("https://vdo.ninja/");
  url.searchParams.set("room", room);
  url.searchParams.set("view", streamId);
  url.searchParams.append("solo", "");
  return url.toString();
}
export function directorUrl(room: string): string {
  if (!isRoomId(room)) throw new Error("Sala inválida.");
  const url = new URL("https://vdo.ninja/");
  url.searchParams.set("director", room);
  return url.toString();
}

export type ObsGuest = { streamId: string; label: string };

/**
 * VDO.Ninja iframe getGuestList replies vary by version.
 * Only accept a concrete stream ID, never a numeric slot index.
 */
export function parseGuestList(input: unknown): ObsGuest[] | null {
  if (!Array.isArray(input)) return null;
  const guests: ObsGuest[] = [];
  const seen = new Set<string>();
  for (const value of input) {
    if (!value || typeof value !== "object") continue;
    const item = value as Record<string, unknown>;
    const id = [item.streamID, item.streamId, item.streamid, item.stream, item.id]
      .find(v => typeof v === "string" && /^[A-Za-z0-9_-]{3,64}$/.test(v)) as string | undefined;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const label = typeof item.label === "string" && item.label.trim()
      ? item.label.trim().slice(0, 50)
      : `Convidado ${guests.length + 1}`;
    guests.push({ streamId: id, label });
  }
  return guests;
}
