import { obsSoloUrl } from "./obs.ts";
import type { ObsGuest } from "./obs.ts";

/**
 * OBS WebSocket v5, running only on THIS computer.
 * The password is never saved or sent to the Podcast backend.
 */
export type ObsScene = { sceneName: string };
export type ObsImportReport = {
  created: number;
  linked: number;
  alreadyPresent: number;
  failures: string[];
};
type Json = Record<string, unknown>;

function record(value: unknown): Json {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Json : {};
}
export function obsLocalUrl(port: number): string {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("A porta do OBS precisa estar entre 1 e 65535.");
  }
  // Do not allow arbitrary hosts or remote unauthenticated WebSocket targets.
  return `ws://127.0.0.1:${port}`;
}
function base64Bytes(bytes: Uint8Array): string {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}
async function sha256Base64(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return base64Bytes(new Uint8Array(digest));
}
export async function obsAuthString(password: string, salt: string, challenge: string): Promise<string> {
  const secret = await sha256Base64(password + salt);
  return sha256Base64(secret + challenge);
}
export function obsInputName(room: string, streamId: string): string {
  // Stream ID and room distinguish repeated calls and separate recordings.
  if (!/^aulas-[0-9a-f]{24}$/.test(room) || !/^[a-zA-Z0-9_-]{3,64}$/.test(streamId)) {
    throw new Error("Sala ou câmera inválida.");
  }
  return `Podcast ${room.slice(-6)} - ${streamId}`;
}
type PendingRequest = {
  resolve: (value: Json) => void;
  reject: (reason: Error) => void;
  timeout: number;
};

export class ObsConnection {
  private requests = new Map<string, PendingRequest>();
  private counter = 0;
  private closeHandlers = new Set<() => void>();
  constructor(private readonly socket: WebSocket) {
    socket.addEventListener("message", event => {
      let message: Json;
      try { message = record(JSON.parse(String(event.data))); }
      catch { return; }
      if (message.op !== 7) return;
      const data = record(message.d);
      const id = data.requestId;
      if (typeof id !== "string") return;
      const pending = this.requests.get(id);
      if (!pending) return;
      this.requests.delete(id);
      window.clearTimeout(pending.timeout);
      const status = record(data.requestStatus);
      if (status.result === true) pending.resolve(record(data.responseData));
      else pending.reject(new Error(
        typeof status.comment === "string" ? status.comment : `Falha OBS (${String(status.code ?? "desconhecida")}).`
      ));
    });
    socket.addEventListener("close", () => {
      for (const pending of this.requests.values()) {
        window.clearTimeout(pending.timeout);
        pending.reject(new Error("Conexão com o OBS encerrada."));
      }
      this.requests.clear();
      for (const callback of this.closeHandlers) callback();
    });
  }
  get connected(): boolean { return this.socket.readyState === WebSocket.OPEN; }
  onDisconnect(callback: () => void): () => void {
    this.closeHandlers.add(callback);
    return () => this.closeHandlers.delete(callback);
  }
  close(): void { this.socket.close(); }

  call(requestType: string, requestData: Json = {}): Promise<Json> {
    if (!this.connected) return Promise.reject(new Error("OBS desconectado."));
    const requestId = `podcast-${++this.counter}`;
    return new Promise<Json>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        this.requests.delete(requestId);
        reject(new Error(`O OBS não respondeu ao comando ${requestType}.`));
      }, 10_000);
      this.requests.set(requestId, { resolve, reject, timeout });
      try {
        this.socket.send(JSON.stringify({ op: 6, d: { requestType, requestId, requestData } }));
      } catch (cause) {
        window.clearTimeout(timeout);
        this.requests.delete(requestId);
        reject(cause instanceof Error ? cause : new Error("Falha ao enviar comando ao OBS."));
      }
    });
  }

  async scenes(): Promise<{ scenes: ObsScene[]; current: string }> {
    const response = await this.call("GetSceneList");
    const scenes = Array.isArray(response.scenes)
      ? response.scenes.map(item => record(item)).filter(item => typeof item.sceneName === "string")
          .map(item => ({ sceneName: item.sceneName as string }))
      : [];
    return {
      scenes,
      current: typeof response.currentProgramSceneName === "string"
        ? response.currentProgramSceneName : (scenes[0]?.sceneName ?? "")
    };
  }

  async addGuests(room: string, sceneName: string, guests: ObsGuest[]): Promise<ObsImportReport> {
    if (!sceneName) throw new Error("Escolha a cena que receberá as fontes.");
    if (guests.length < 1) throw new Error("Ainda não há convidados detectados pelo VDO.Ninja.");
    if (guests.length > 30) throw new Error("Limite de 30 convidados por importação.");
    // Query once and check both global input names and items in the target scene.
    const [inputsData, itemsData] = await Promise.all([
      this.call("GetInputList"),
      this.call("GetSceneItemList", { sceneName })
    ]);
    const inputNames = new Map<string, string>();
    for (const entry of Array.isArray(inputsData.inputs) ? inputsData.inputs : []) {
      const input = record(entry);
      if (typeof input.inputName === "string" && typeof input.inputKind === "string") {
        inputNames.set(input.inputName, input.inputKind);
      }
    }
    const itemNames = new Set<string>();
    for (const entry of Array.isArray(itemsData.sceneItems) ? itemsData.sceneItems : []) {
      const item = record(entry);
      if (typeof item.sourceName === "string") itemNames.add(item.sourceName);
    }
    const report: ObsImportReport = { created: 0, linked: 0, alreadyPresent: 0, failures: [] };
    const seen = new Set<string>();
    for (const guest of guests) {
      if (seen.has(guest.streamId)) continue;
      seen.add(guest.streamId);
      const inputName = obsInputName(room, guest.streamId);
      if (itemNames.has(inputName)) {
        report.alreadyPresent++;
        continue;
      }
      try {
        if (inputNames.has(inputName)) {
          if (inputNames.get(inputName) !== "browser_source") {
            throw new Error("Já existe uma fonte com esse nome e outro tipo.");
          }
          await this.call("CreateSceneItem", { sceneName, sourceName: inputName, sceneItemEnabled: true });
          report.linked++;
        } else {
          await this.call("CreateInput", {
            sceneName, inputName, inputKind: "browser_source",
            inputSettings: { url: obsSoloUrl(room, guest.streamId), width: 1280, height: 720 },
            sceneItemEnabled: true
          });
          inputNames.set(inputName, "browser_source");
          report.created++;
        }
        itemNames.add(inputName);
      } catch (error) {
        report.failures.push(`${guest.label}: ${error instanceof Error ? error.message : "erro desconhecido"}`);
      }
    }
    return report;
  }
}

export async function connectLocalObs(password: string, port: number): Promise<ObsConnection> {
  const url = obsLocalUrl(port);
  return new Promise<ObsConnection>((resolve, reject) => {
    let finished = false;
    let identified = false;
    let socket: WebSocket;
    try { socket = new WebSocket(url); }
    catch (error) {
      reject(new Error(error instanceof Error ? error.message : "O navegador bloqueou a conexão local."));
      return;
    }
    const fail = (message: string) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      socket.close();
      reject(new Error(message));
    };
    const timer = window.setTimeout(() => fail(
      "O OBS não respondeu. Abra o OBS e ative Ferramentas → Configurações do servidor WebSocket."
    ), 9000);
    socket.addEventListener("message", async event => {
      let payload: Json;
      try { payload = record(JSON.parse(String(event.data))); }
      catch { return; }
      if (finished) return;
      if (payload.op === 0) {
        const hello = record(payload.d);
        const data: Json = { rpcVersion: 1, eventSubscriptions: 0 };
        const auth = record(hello.authentication);
        if (Object.keys(auth).length) {
          if (!password) { fail("Digite a senha do WebSocket exibida nas configurações do OBS."); return; }
          if (typeof auth.salt !== "string" || typeof auth.challenge !== "string") {
            fail("O OBS enviou um desafio de autenticação inválido."); return;
          }
          try {
            data.authentication = await obsAuthString(password, auth.salt, auth.challenge);
          } catch {
            fail("Não foi possível autenticar a conexão com o OBS."); return;
          }
        }
        if (!finished) socket.send(JSON.stringify({ op: 1, d: data }));
      } else if (payload.op === 2) {
        identified = true;
        finished = true;
        window.clearTimeout(timer);
        resolve(new ObsConnection(socket));
      }
    });
    socket.addEventListener("error", () => {
      if (!finished) fail("Não foi possível conectar ao OBS local. Verifique o servidor WebSocket, a porta e as permissões de rede local do navegador.");
    });
    socket.addEventListener("close", event => {
      if (!finished) fail(event.code === 4009 || event.code === 4005
        ? "Senha incorreta do WebSocket do OBS."
        : identified ? "Conexão com o OBS encerrada." : "O OBS recusou a conexão. Confira a senha e a porta.");
    });
  });
}
