import { useState } from "react";
import { podcastStudioUrl } from "./recording";
import type { CloudProvider } from "./recording";

type Props = { room: string };
export default function RecordingGuide({ room }: Props) {
  const [cloud, setCloud] = useState<CloudProvider>("drive");
  const studio = podcastStudioUrl(room, cloud);
  return (
    <section className="recording-guide" aria-label="Gravação no computador e na nuvem">
      <div className="recording-guide-head">
        <div>
          <span className="eyebrow">Gravação sem OBS · Podcast Studio</span>
          <h2>Salvar no computador + na nuvem</h2>
          <p>Use o estúdio de gravação do VDO.Ninja conectado a esta sala.
            A gravação só começa quando você autoriza e aciona os controles no estúdio.</p>
        </div>
        <span className="recording-badge">Preparação manual</span>
      </div>
      <div className="recording-destinations" aria-label="Destinos desejados">
        <div className="recording-destination"><strong>1. Meu computador</strong>
          <span>Uma cópia local; no Chrome/Edge é possível selecionar uma pasta.</span>
        </div>
        <div className="recording-destination">
          <label htmlFor="recording-cloud">2. Backup na nuvem</label>
          <select id="recording-cloud" value={cloud}
            onChange={e => setCloud(e.target.value as CloudProvider)}>
            <option value="drive">Google Drive</option>
            <option value="dropbox">Dropbox</option>
          </select>
          <span>Você conecta sua própria conta no VDO.Ninja, com autorização OAuth.</span>
        </div>
      </div>
      <a className="button button-primary recording-launch" href={studio}
        target="_blank" rel="noopener noreferrer">
        Abrir estúdio de gravação
      </a>
      <ol className="recording-steps">
        <li>Abra o link no <strong>computador com Chrome ou Edge</strong> e mantenha o Podcast aberto.
          Use fones e evite deixar dois microfones ativos.</li>
        <li>Em <strong>Recording settings</strong>, defina a pasta local e conecte o
          {cloud === "drive" ? " Google Drive" : " Dropbox"}. Para o Drive,
          ative também <strong>Enable guest backup</strong>.</li>
        <li>Peça autorização de gravação a cada convidado. Confira quais trilhas de áudio
          e quais vídeos individuais estão marcados para captura.</li>
        <li>Inicie a gravação no estúdio. No final, clique em <strong>Stop</strong> e
          mantenha a página aberta até todos os arquivos serem salvos e os envios terminarem.</li>
        <li>Antes de encerrar a sessão, confira os arquivos locais e a pasta na nuvem.
          Se um dos dois destinos falhar, a gravação ainda não está protegida por duas cópias.</li>
      </ol>
      <div className="recording-limits">
        <strong>Importante sobre os vídeos separados:</strong> o Podcast Studio documenta
        gravação de áudio por participante e recursos de gravação de vídeo, mas o backup
        automático de <em>cada vídeo individual</em> na nuvem ainda exige um teste real.
        Este botão apenas abre os controles nativos do VDO.Ninja; não grava nem faz upload
        diretamente pelo Podcast Lab.
      </div>
      <p className="recording-help">
        <a href="https://docs.vdo.ninja/guides/options-to-record-streams"
          target="_blank" rel="noopener noreferrer">Documentação oficial de gravação</a>
        {" · "}
        <a href="https://vdo.ninja/podcast/cloud.html"
          target="_blank" rel="noopener noreferrer">Como conectar Google Drive ou Dropbox</a>
      </p>
    </section>
  );
}
