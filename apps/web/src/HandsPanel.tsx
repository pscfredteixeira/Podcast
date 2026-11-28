import { useEffect, useRef, useState } from "react";
import { applyHandSignal, getHandSignal, makeHandSignal, pruneHands } from "./handSignal";
import type { HandEntry } from "./handSignal";
type Props = {
  name: string;
  frame: React.RefObject<HTMLIFrameElement | null>;
  frameLoaded: boolean;
};
function newParticipantId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID().replaceAll("-", "");
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}
export default function HandsPanel({ name, frame, frameLoaded }: Props) {
  const [ownRaised, setOwnRaised] = useState(false);
  const ownRaisedRef = useRef(false);
  const [remoteHands, setRemoteHands] = useState<HandEntry[]>([]);
  const selfId = useRef(newParticipantId()).current;
  const displayName = name.trim().slice(0, 48) || "Convidado";
  // Comunicar-se pelo iframe original da chamada, não pelo iframe do diretor.
  function send(raised: boolean): void {
    if (!frameLoaded || !frame.current?.contentWindow) return;
    frame.current.contentWindow.postMessage({
      sendData: { podcastHands: makeHandSignal(selfId, displayName, raised) },
      type: "pcs"
    }, "https://vdo.ninja");
  }
  function toggle(): void {
    const next = !ownRaisedRef.current;
    ownRaisedRef.current = next;
    setOwnRaised(next);
    send(next);
  }
  useEffect(() => {
    function receive(event: MessageEvent) {
      if (event.origin !== "https://vdo.ninja" ||
          event.source !== frame.current?.contentWindow) return;
      const data = event.data;
      if (!data || typeof data !== "object") return;
      const payload = data as Record<string, unknown>;
      if ("dataReceived" in payload) {
        const signal = getHandSignal(payload.dataReceived);
        if (signal) setRemoteHands(previous =>
          applyHandSignal(previous, signal, Date.now(), selfId)
        );
      }
      // Ao entrar uma pessoa nova, reanunciar a mão que já estava levantada.
      if (payload.action === "guest-connected" && ownRaisedRef.current) send(true);
    }
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [frame, frameLoaded, displayName, selfId]);

  useEffect(() => {
    if (!frameLoaded) return;
    // O VDO.Ninja entrega dados entre pares já conectados. Reenviar o
    // status ativo evita que quem entrou depois fique sem o aviso.
    if (ownRaisedRef.current) send(true);
    const timer = window.setInterval(() => {
      if (ownRaisedRef.current) send(true);
      setRemoteHands(previous => pruneHands(previous, Date.now()));
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [frame, frameLoaded, selfId, displayName]);

  useEffect(() => () => {
    if (ownRaisedRef.current && frame.current?.contentWindow) {
      frame.current.contentWindow.postMessage({
        sendData: { podcastHands: makeHandSignal(selfId, displayName, false) },
        type: "pcs"
      }, "https://vdo.ninja");
    }
  }, [frame, selfId, displayName]);
  const names = remoteHands.map(item => ({ id: item.participantId, name: item.name }));
  if (ownRaised) names.unshift({ id: selfId, name: `${displayName} (você)` });

  return (
    <div className="podcast-hands" aria-label="Mãos levantadas na sala">
      <div className="podcast-hands-controls">
        <button type="button"
          className={ownRaised ? "button podcast-hands-button podcast-hands-button--active" : "button podcast-hands-button"}
          aria-pressed={ownRaised}
          disabled={!frameLoaded}
          onClick={toggle}>
          <span aria-hidden="true">✋</span> {ownRaised ? "Abaixar minha mão" : "Levantar a mão"}
        </button>
        <span className="podcast-hands-caption">
          {frameLoaded
            ? "O pedido de fala aparece para todos os participantes conectados."
            : "Conectando à videochamada…"}
        </span>
      </div>
      {names.length > 0 && (
        <div className="podcast-hands-raised" role="status" aria-live="polite">
          <strong>{names.length === 1 ? "Mão levantada:" : `${names.length} mãos levantadas:`}</strong>
          <div className="podcast-hands-names">
            {names.map(item => (
              <span className="podcast-hands-name" key={item.id}>
                <span aria-hidden="true">✋</span> {item.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
