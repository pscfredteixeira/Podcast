/**
 * Mãos levantadas em tempo real usando o canal de dados P2P do VDO.Ninja.
 * Não há servidor nesta versão: as mãos são anunciadas novamente a cada
 * poucos segundos para sincronizar participantes que entram mais tarde.
 */
export const HANDS_CHANNEL = "podcast-hands-v1";
export const HANDS_TTL_MS = 18_000;

export type HandSignal = {
  channel: typeof HANDS_CHANNEL;
  participantId: string;
  name: string;
  raised: boolean;
};
export type HandEntry = {
  participantId: string;
  name: string;
  seenAt: number;
};
const validId = (id: unknown) =>
  typeof id === "string" && /^[a-zA-Z0-9_-]{8,64}$/.test(id);

export function makeHandSignal(participantId: string, name: string, raised: boolean): HandSignal {
  if (!validId(participantId)) throw new Error("Identificador de participante inválido.");
  return { channel: HANDS_CHANNEL, participantId, name: name.trim().slice(0, 48), raised };
}
export function getHandSignal(message: unknown): HandSignal | null {
  if (!message || typeof message !== "object") return null;
  const envelope = message as Record<string, unknown>;
  // VDO.Ninja envelopes data as {dataReceived:{podcastHands:{...}}}.
  const payload = envelope.podcastHands && typeof envelope.podcastHands === "object"
    ? envelope.podcastHands as Record<string, unknown>
    : envelope;
  if (payload.channel !== HANDS_CHANNEL || !validId(payload.participantId) ||
    typeof payload.raised !== "boolean" || typeof payload.name !== "string" ||
    payload.name.length > 80) return null;
  return makeHandSignal(payload.participantId, payload.name, payload.raised);
}
export function applyHandSignal(
  current: HandEntry[], message: HandSignal, now: number, selfId: string
): HandEntry[] {
  if (message.participantId === selfId) return current;
  const present = current.filter(item => item.participantId !== message.participantId &&
    now - item.seenAt <= HANDS_TTL_MS);
  if (!message.raised) return present;
  return [...present, {
    participantId: message.participantId,
    name: message.name || "Convidado",
    seenAt: now
  }].slice(-40);
}
export function pruneHands(current: HandEntry[], now: number): HandEntry[] {
  return current.filter(item => now - item.seenAt <= HANDS_TTL_MS);
}
