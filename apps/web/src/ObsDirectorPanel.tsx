import { useEffect, useRef, useState } from "react";
import { directorUrl, obsSoloUrl, parseGuestList } from "./obs";
import type { ObsGuest } from "./obs";

type Props = { room: string };

export default function ObsDirectorPanel({ room }: Props) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [guests, setGuests] = useState<ObsGuest[]>([]);
  const [seenReply, setSeenReply] = useState(false);
  const [error, setError] = useState("");
  const [copyNote, setCopyNote] = useState("");
  const iframeUrl = directorUrl(room);

  function refresh() {
    const child = frameRef.current?.contentWindow;
    if (!child || !ready) return;
    child.postMessage({
      action: "getGuestList", cib: "podcast-obs-guests"
    }, "https://vdo.ninja");
  }

  useEffect(() => {
    if (!enabled) return;
    function onMessage(event: MessageEvent) {
      // Never accept a supposed guest list from another browser frame or origin.
      if (event.origin !== "https://vdo.ninja" ||
        event.source !== frameRef.current?.contentWindow) return;
      const data = event.data;
      if (!data || typeof data !== "object") return;
      const message = data as Record<string, unknown>;
      if (message.cib === "podcast-obs-guests" && "guestList" in message) {
        const parsed = parseGuestList(message.guestList);
        if (parsed) {
          setGuests(parsed);
          setSeenReply(true);
          setError("");
        }
      }
      if (message.action === "guest-connected" || message.action === "guest-disconnected") {
        // The periodic request also reconciles guests that disconnected.
        frameRef.current?.contentWindow?.postMessage(
          { action: "getGuestList", cib: "podcast-obs-guests" }, "https://vdo.ninja"
        );
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !ready) return;
    refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => window.clearInterval(timer);
  }, [enabled, ready, room]);

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopyNote("Link copiado. Cole em uma Fonte de navegador do OBS.");
    } catch {
      setCopyNote("Não foi possível copiar automaticamente. Selecione e copie o link abaixo.");
    }
  }

  return (
    <section className="obs-producer-panel" aria-label="Fontes individuais para o OBS">
      <header className="obs-producer-heading">
        <div>
          <span className="eyebrow">Produção · acesso local</span>
          <h2>Fontes individuais para o OBS</h2>
          <p>Visualize cada convidado em uma fonte separada do OBS Studio.</p>
        </div>
        {!enabled && (
          <button className="button button-primary" type="button"
            onClick={() => { setEnabled(true); setError(""); }}>
            Conectar painel diretor
          </button>
        )}
      </header>

      <p className="obs-advice">
        O VDO.Ninja fornece um link SOLO para cada vídeo. Estes links exibem a transmissão no OBS,
        mas não gravam os participantes por conta própria. Grave no OBS e peça consentimento.
        Esta interface experimental não possui autenticação de produtor por servidor.
      </p>

      <div className="obs-producer-actions">
        <a className="button button-outline" href={iframeUrl}
          target="_blank" rel="noopener noreferrer">
          Abrir diretor do VDO.Ninja em outra aba
        </a>
        {enabled && (
          <button className="button button-outline" type="button"
            onClick={refresh} disabled={!ready}>Atualizar convidados</button>
        )}
      </div>

      {enabled && (
        <>
          <div className="obs-director-frame">
            <iframe
              ref={frameRef}
              title="Diretor do VDO.Ninja para identificar convidados"
              src={iframeUrl}
              allow="camera; microphone; autoplay; fullscreen"
              onLoad={() => setReady(true)}
              referrerPolicy="no-referrer"
            />
          </div>
          <p className="obs-advice">
            O diretor pode reproduzir áudio adicional. Use fones e silencie um dos painéis
            para evitar eco. Somente uma janela deve controlar o microfone.
          </p>
          <div className="obs-guest-heading">
            <h3>Links SOLO para o OBS</h3>
            <span>{seenReply ? `${guests.length} fonte(s) identificada(s)` : "Consultando convidados…"}</span>
          </div>
          {!guests.length && (
            <p className="obs-advice" role="status">
              {seenReply
                ? "Nenhum stream ID disponível agora. Confirme que os convidados já iniciaram a câmera no VDO.Ninja."
                : "Aguardando resposta do diretor do VDO.Ninja. Se os links não aparecerem, copie o SOLO LINK na própria tela do diretor."}
            </p>
          )}
          <div className="obs-guest-list">
            {guests.map(guest => {
              const url = obsSoloUrl(room, guest.streamId);
              return (
                <div className="obs-guest-card" key={guest.streamId}>
                  <strong>{guest.label}</strong>
                  <span className="obs-guest-id">Stream ID: {guest.streamId}</span>
                  <input readOnly value={url} aria-label={`Link OBS de ${guest.label}`}
                    onFocus={event => event.currentTarget.select()} />
                  <button type="button" className="button button-primary"
                    onClick={() => void copy(url)}>
                    Copiar fonte para OBS
                  </button>
                </div>
              );
            })}
          </div>
          {copyNote && <p className="feedback" role="status">{copyNote}</p>}
          {error && <p className="feedback feedback-error" role="alert">{error}</p>}
          <button className="button button-subtle" type="button"
            onClick={() => { setEnabled(false); setReady(false); setGuests([]); setSeenReply(false); }}>
            Desconectar painel diretor
          </button>
        </>
      )}
    </section>
  );
}
