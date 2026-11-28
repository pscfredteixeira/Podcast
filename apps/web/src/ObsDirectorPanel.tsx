import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { directorUrl, obsSoloUrl, manualObsGuest, parseVdoGuestResponse } from "./obs";
import type { ObsGuest } from "./obs";
import { connectLocalObs } from "./obsWebsocket";
import type { ObsConnection, ObsScene, ObsImportReport } from "./obsWebsocket";

type Props = { room: string; callFrameRef: RefObject<HTMLIFrameElement | null> };

export default function ObsDirectorPanel({ room, callFrameRef }: Props) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  // O diretor fica conectado desde a abertura da sala para oferecer
  // fontes individuais; as mãos são sincronizadas pelo iframe da chamada.
  const [enabled, setEnabled] = useState(true);
  const [ready, setReady] = useState(false);
  const [directorGuests, setDirectorGuests] = useState<ObsGuest[]>([]);
  const [callGuests, setCallGuests] = useState<ObsGuest[]>([]);
  const [manualGuests, setManualGuests] = useState<ObsGuest[]>([]);
  const [manualLink, setManualLink] = useState("");
  const [seenReply, setSeenReply] = useState(false);
  const [error, setError] = useState("");
  const guests = useMemo(() => {
    const byId = new Map<string, ObsGuest>();
    for (const guest of [...callGuests, ...directorGuests, ...manualGuests]) {
      const existing = byId.get(guest.streamId);
      if (!existing || existing.label.startsWith("Convidado") ||
          existing.label.startsWith("Câmera ")) byId.set(guest.streamId, guest);
    }
    return [...byId.values()];
  }, [callGuests, directorGuests, manualGuests]);
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
    const director = frameRef.current?.contentWindow;
    if (director && ready) {
      // O VDO.Ninja documenta dois formatos de solicitação. Ambos são
      // compatíveis com versões diferentes do iframe diretor.
      director.postMessage({ getGuestList: true, cib: "podcast-obs-guests" }, "https://vdo.ninja");
      director.postMessage({ action: "getGuestList", cib: "podcast-obs-guests" }, "https://vdo.ninja");
      director.postMessage({ getStreamIDs: true, cib: "podcast-obs-streams" }, "https://vdo.ninja");
    }
    // Segundo canal: a videochamada principal também conhece os stream IDs.
    callFrameRef.current?.contentWindow?.postMessage(
      { getStreamIDs: true, cib: "podcast-obs-streams" }, "https://vdo.ninja"
    );
  }

  function addManualGuest() {
    try {
      const guest = manualObsGuest(manualLink, room);
      setManualGuests(previous => previous.some(g => g.streamId === guest.streamId)
        ? previous : [...previous, guest]);
      setManualLink("");
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Link inválido.");
    }
  }

  useEffect(() => {
    if (!enabled) return;
    function onMessage(event: MessageEvent) {
      // Respostas só podem vir de um dos nossos dois iframes VDO.Ninja.
      if (event.origin !== "https://vdo.ninja") return;
      const isDirector = event.source === frameRef.current?.contentWindow;
      const isCall = event.source === callFrameRef.current?.contentWindow;
      if (!isDirector && !isCall) return;
      const data = event.data;
      if (!data || typeof data !== "object") return;
      const message = data as Record<string, unknown>;
      const parsed = parseVdoGuestResponse(message);
      if (parsed !== null) {
        if (isDirector) setDirectorGuests(parsed);
        else setCallGuests(parsed);
        setSeenReply(true);
        setError("");
      }
      // Fallback ao conectar uma câmera: alguns VDOs notificam o streamID
      // sem responder ao comando getGuestList.
      if (message.action === "guest-connected" && typeof message.streamID === "string") {
        try {
          const guest = manualObsGuest(message.streamID, room);
          const label = message.value && typeof message.value === "object" &&
            typeof (message.value as Record<string, unknown>).label === "string"
            ? String((message.value as Record<string, unknown>).label).slice(0, 50)
            : guest.label;
          const next = { ...guest, label };
          if (isDirector) setDirectorGuests(current =>
            [...current.filter(g => g.streamId !== next.streamId), next]);
          else setCallGuests(current =>
            [...current.filter(g => g.streamId !== next.streamId), next]);
          setSeenReply(true);
        } catch { /* IDs não compatíveis não são adicionados. */ }
      }
      if (message.action === "guest-connected" ||
          message.action === "guest-disconnected") {
        // Atualiza a lista sem reiniciar os iframes existentes.
        window.setTimeout(() => {
          frameRef.current?.contentWindow?.postMessage(
            { getGuestList: true, cib: "podcast-obs-guests" }, "https://vdo.ninja"
          );
          callFrameRef.current?.contentWindow?.postMessage(
            { getStreamIDs: true, cib: "podcast-obs-streams" }, "https://vdo.ninja"
          );
        }, 500);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [enabled, callFrameRef, room]);

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
          <h2>Direção do Podcast · fontes para OBS</h2>
          <p>Os pedidos de fala aparecem acima da videochamada, para todos.
          Este painel reúne os links individuais de vídeo para o OBS.</p>
        </div>
        {!enabled && (
          <button className="button button-primary" type="button"
            onClick={() => { setEnabled(true); setError(""); }}>
            Conectar painel diretor
          </button>
        )}
      </header>

      <p className="obs-advice">
        O pedido de fala do Podcast agora é compartilhado com todos pelo vídeo,
        não depende de alertas do diretor nativo do VDO.Ninja.
      </p>
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
                ? "O OBS está disponível, mas nenhuma câmera foi identificada. Confira se os convidados já entraram e ativaram o vídeo. Você também pode adicionar um link SOLO manualmente abaixo."
                : "Aguardando IDs das câmeras pelo VDO.Ninja. Se a lista continuar vazia, use o campo de link manual abaixo."}
            </p>
          )}
          <div className="obs-manual-source">
            <label htmlFor="obs-manual-link">Adicionar uma câmera pelo link SOLO ou stream ID</label>
            <div className="obs-manual-source-row">
              <input id="obs-manual-link" type="text" value={manualLink}
                onChange={event => setManualLink(event.target.value)}
                placeholder="https://vdo.ninja/?view=... ou stream ID"
                onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addManualGuest(); } }} />
              <button className="button button-outline" type="button"
                disabled={!manualLink.trim()} onClick={addManualGuest}>
                Adicionar câmera
              </button>
            </div>
            <p className="obs-advice">Caso a identificação automática falhe, copie o
              SOLO LINK do convidado no diretor do VDO.Ninja. Depois de adicionar,
              use o botão “Enviar fontes para o OBS”.</p>
          </div>
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
                  {manualGuests.some(g => g.streamId === guest.streamId) && (
                    <button type="button" className="button button-subtle"
                      onClick={() => setManualGuests(current =>
                        current.filter(g => g.streamId !== guest.streamId))}>
                      Retirar link manual
                    </button>
                  )}
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
          <p className="obs-advice">Mantenha esta sala aberta enquanto recebe solicitações de fala.
            Para encerrar a direção, saia da chamada do Podcast.</p>
        </>
      )}
    </section>
  );
}
