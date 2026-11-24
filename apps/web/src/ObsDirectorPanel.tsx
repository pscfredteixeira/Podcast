import { useEffect, useRef, useState } from "react";
import { directorUrl, obsSoloUrl, parseGuestList } from "./obs";
import type { ObsGuest } from "./obs";
import { connectLocalObs } from "./obsWebsocket";
import type { ObsConnection, ObsScene, ObsImportReport } from "./obsWebsocket";

type Props = { room: string };

export default function ObsDirectorPanel({ room }: Props) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [guests, setGuests] = useState<ObsGuest[]>([]);
  const [seenReply, setSeenReply] = useState(false);
  const [error, setError] = useState("");
  const [copyNote, setCopyNote] = useState("");
  const [obs, setObs] = useState<ObsConnection | null>(null);
  const obsRef = useRef<ObsConnection | null>(null);
  const [obsPort, setObsPort] = useState("4455");
  const [obsPassword, setObsPassword] = useState("");
  const [obsScenes, setObsScenes] = useState<ObsScene[]>([]);
  const [obsScene, setObsScene] = useState("");
  const [obsBusy, setObsBusy] = useState(false);
  const [obsError, setObsError] = useState("");
  const [obsReport, setObsReport] = useState<ObsImportReport | null>(null);
  const iframeUrl = directorUrl(room);

  useEffect(() => () => {
    obsRef.current?.close();
    obsRef.current = null;
  }, []);

  async function connectObs() {
    if (obsBusy || obsRef.current) return;
    setObsBusy(true);
    setObsError("");
    setObsReport(null);
    let connection: ObsConnection | null = null;
    try {
      connection = await connectLocalObs(obsPassword, Number(obsPort));
      const result = await connection.scenes();
      if (!result.scenes.length) throw new Error("O OBS não possui cenas. Crie uma cena no OBS primeiro.");
      connection.onDisconnect(() => {
        obsRef.current = null;
        setObs(null);
        setObsError("A conexão com o OBS foi encerrada. Conecte novamente.");
      });
      obsRef.current = connection;
      setObs(connection);
      setObsScenes(result.scenes);
      setObsScene(result.current);
      setObsPassword(""); // A senha nunca é persistida no site.
    } catch (error) {
      connection?.close();
      setObsError(error instanceof Error ? error.message : "Não foi possível conectar ao OBS.");
    } finally {
      setObsBusy(false);
    }
  }
  async function sendAllToObs() {
    if (!obs?.connected || obsBusy || !obsScene || guests.length === 0) return;
    setObsBusy(true);
    setObsError("");
    setObsReport(null);
    try {
      const result = await obs.addGuests(room, obsScene, guests);
      setObsReport(result);
    } catch (error) {
      setObsError(error instanceof Error ? error.message : "Não foi possível enviar as fontes ao OBS.");
    } finally {
      setObsBusy(false);
    }
  }
  function disconnectObs() {
    obsRef.current?.close();
    obsRef.current = null;
    setObs(null);
    setObsScenes([]);
    setObsScene("");
    setObsReport(null);
    setObsError("");
  }

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
      // VDO.Ninja returns either a guestList property or callback.result.
      const callback = message.callback && typeof message.callback === "object"
        ? message.callback as Record<string, unknown> : null;
      const guestData = "guestList" in message ? message.guestList
        : callback && "result" in callback ? callback.result : null;
      if ((message.cib === "podcast-obs-guests" || message.action === "getGuestList") && guestData !== null) {
        const parsed = parseGuestList(guestData);
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
          <section className="obs-auto-import" aria-label="Enviar todas as fontes ao OBS">
            <h3>Enviar todos diretamente para o OBS</h3>
            <p className="obs-advice">
              Com o OBS aberto neste computador, acesse <strong>Ferramentas → Configurações do
              servidor WebSocket</strong>, ative o servidor e use a senha em
              <strong> Mostrar informações de conexão</strong>. O padrão é a porta 4455.
              A senha fica somente nesta aba e nunca é enviada ao GitHub.
            </p>
            {!obs?.connected ? (
              <div className="obs-connect-form">
                <label htmlFor="obs-port">Porta local do OBS
                  <input id="obs-port" type="number" inputMode="numeric" min="1" max="65535"
                    value={obsPort} onChange={event => setObsPort(event.target.value)} />
                </label>
                <label htmlFor="obs-password">Senha WebSocket do OBS
                  <input id="obs-password" type="password" autoComplete="off"
                    placeholder="Senha em Mostrar informações de conexão"
                    value={obsPassword} onChange={event => setObsPassword(event.target.value)} />
                </label>
                <button className="button button-primary" type="button" disabled={obsBusy}
                  onClick={() => void connectObs()}>
                  {obsBusy ? "Conectando…" : "Conectar ao OBS"}
                </button>
              </div>
            ) : (
              <div className="obs-import-ready">
                <p className="obs-connected" role="status">OBS conectado neste computador</p>
                <div className="obs-import-select">
                  <label htmlFor="obs-target-scene">Cena que receberá as fontes</label>
                  <select id="obs-target-scene" value={obsScene}
                    onChange={event => setObsScene(event.target.value)}>
                    {obsScenes.map(scene => (
                      <option key={scene.sceneName} value={scene.sceneName}>{scene.sceneName}</option>
                    ))}
                  </select>
                </div>
                <button className="button button-primary" type="button"
                  disabled={obsBusy || guests.length === 0 || !obsScene}
                  onClick={() => void sendAllToObs()}>
                  {obsBusy ? "Enviando fontes…" : `Enviar ${guests.length} fonte(s) para o OBS`}
                </button>
                <button className="button button-subtle" type="button"
                  disabled={obsBusy} onClick={disconnectObs}>Desconectar OBS</button>
              </div>
            )}
            {obsReport && <div className="obs-import-result" role="status">
              <strong>Importação concluída.</strong> {obsReport.created} fonte(s) criada(s),
              {" "}{obsReport.linked} vinculada(s) à cena e
              {" "}{obsReport.alreadyPresent} já presente(s).
              {obsReport.failures.length > 0 && (
                <p>Não foi possível incluir: {obsReport.failures.join(" | ")}</p>
              )}
            </div>}
            {obsError && <p className="feedback feedback-error" role="alert">{obsError}</p>}
            <p className="obs-advice">
              Cada convidado vira uma Fonte de navegador independente. Ao clicar novamente,
              o site não duplica as fontes existentes. Ele não inicia gravação nem altera
              cenas fora da escolhida. Se o navegador pedir permissão para a rede local,
              permita o acesso ao OBS neste computador.
            </p>
          </section>
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
