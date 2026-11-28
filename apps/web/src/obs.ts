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
  // O diretor recebe alertas quando alguém levanta a mão.
  url.searchParams.set("notify", "");
  return url.toString();
}

export type ObsGuest = { streamId: string; label: string };

/**
 * VDO.Ninja iframe getGuestList replies vary by version.
 * Only accept a concrete stream ID, never a numeric slot index.
 */
/** Transformar os vários formatos de retorno do IFRAME VDO em fontes OBS.
 * Aceita: {"1":{"streamID":"...","label":"..."}}, arrays de
 * IDs, arrays de objetos, e mapas de stream IDs.
 */
export function parseGuestList(input: unknown): ObsGuest[] | null {
  if (typeof input === "string") {
    try { return parseGuestList(JSON.parse(input) as unknown); } catch { return null; }
  }
  if (!input || typeof input !== "object") return null;
  const validId = (id: unknown): id is string =>
    typeof id === "string" && /^[A-Za-z0-9_-]{3,64}$/.test(id) && !/^\\d+$/.test(id);
  const data = input as Record<string, unknown>;
  const entries: [string, unknown][] = Array.isArray(input)
    ? input.map((v, i) => [String(i + 1), v] as [string, unknown])
    : Object.entries(data);
  // VDO também retorna um único objeto de stream, não só mapas por slot.
  if (!Array.isArray(input) && entries.some(([key]) =>
    ["streamID", "streamId", "streamid"].includes(key))) {
    return parseGuestList([input]);
  }
  const guests: ObsGuest[] = [];
  const seen = new Set<string>();
  for (const [slot, value] of entries) {
    const obj = value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown> : null;
    const id = obj
      ? [obj.streamID, obj.streamId, obj.streamid, obj.stream, obj.id,
         obj.uuid, slot].find(validId)
      // Stream list arrays contain IDs; stream maps may be keyed by ID.
      : validId(slot) ? slot : validId(value) ? value : null;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const label = obj && typeof obj.label === "string" && obj.label.trim()
      ? obj.label.trim().slice(0, 50)
      : obj && typeof obj.name === "string" && obj.name.trim()
        ? obj.name.trim().slice(0, 50)
        : typeof value === "string" && validId(slot) && value.trim()
          ? value.trim().slice(0, 50)
          : `Convidado ${guests.length + 1}`;
    guests.push({ streamId: id, label });
  }
  return guests;
}

/** Interpreta a resposta do iframe sem exigir o mesmo callback ID em
 * todas as versões. A segurança depende de validar event.source e origin
 * ANTES de chamar esta função.
 */
export function parseVdoGuestResponse(input: unknown): ObsGuest[] | null {
  if (!input || typeof input !== "object") return null;
  const msg = input as Record<string, unknown>;
  const cb = msg.callback && typeof msg.callback === "object"
    ? msg.callback as Record<string, unknown> : null;
  const result = "guestList" in msg ? msg.guestList
    : "streamIDs" in msg ? msg.streamIDs
    : "streamIds" in msg ? msg.streamIds
    : "streamInfo" in msg ? msg.streamInfo
    : "getGuestList" in msg ? msg.getGuestList
    : cb && "result" in cb ? cb.result
    : (msg.cib === "podcast-obs-guests" || msg.cib === "podcast-obs-streams" ||
       msg.action === "getGuestList" || msg.action === "getStreamIDs")
      ? msg.result ?? msg.value ?? msg.data ?? null
      : null;
  if (result != null) return parseGuestList(result);
  // Algumas versões retornam diretamente o mapa de slots sem wrapper.
  if (Object.keys(msg).some(key => /^\\d+$/.test(key) &&
    msg[key] && typeof msg[key] === "object")) return parseGuestList(msg);
  return null;
}

export function manualObsGuest(input: string, room: string): ObsGuest {
  const text = input.trim();
  let streamId = text;
  if (/^https?:\\/\\//i.test(text)) {
    let url: URL;
    try { url = new URL(text); }
    catch { throw new Error("Link do VDO.Ninja inválido."); }
    if (url.protocol !== "https:" ||
        !["vdo.ninja", "www.vdo.ninja"].includes(url.hostname)) {
      throw new Error("Cole um link HTTPS do VDO.Ninja ou o identificador da câmera.");
    }
    const linkedRoom = url.searchParams.get("room");
    if (linkedRoom && linkedRoom !== room) {
      throw new Error("Este link pertence a outra sala.");
    }
    streamId = url.searchParams.get("view") || url.searchParams.get("push") || "";
  }
  // A validação final é a mesma aplicada à Fonte de navegador.
  obsSoloUrl(room, streamId);
  return { streamId, label: `Câmera ${streamId.slice(0, 12)}` };
}
