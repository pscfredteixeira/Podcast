import test from "node:test";
import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import { ObsConnection, obsAuthString, obsInputName, obsLocalUrl } from "../src/obsWebsocket.ts";

const room = "aulas-000102030405060708090a0b";

test("OBS somente aceita conexão local, porta válida e nome estável por stream", () => {
  assert.equal(obsLocalUrl(4455), "ws://127.0.0.1:4455");
  assert.throws(() => obsLocalUrl(0));
  assert.throws(() => obsLocalUrl(65536));
  assert.throws(() => obsLocalUrl(4455.3));
  assert.equal(obsInputName(room, "person_123"), "Podcast 090a0b - person_123");
  assert.throws(() => obsInputName(room, "abc&secret=1"));
});

test("senha OBS WebSocket segue SHA256(base64(SHA256(password+salt))+challenge)", async () => {
  globalThis.crypto ??= webcrypto;
  const base64sha = text => createHash("sha256").update(text).digest("base64");
  const password = "example password";
  const salt = "base64salt";
  const challenge = "base64challenge";
  assert.equal(await obsAuthString(password, salt, challenge), base64sha(base64sha(password + salt) + challenge));
});

test("enviar todos cria browser sources, reaproveita fontes e nunca duplica na mesma cena", async () => {
  globalThis.window ??= globalThis;
  const original = globalThis.WebSocket;
  class FakeWebSocket {
    static OPEN = 1;
    readyState = 1;
    listeners = new Map();
    calls = [];
    inputs = [];
    sceneItems = [];
    addEventListener(name, callback) {
      this.listeners.set(name, [...(this.listeners.get(name) || []), callback]);
    }
    emit(name, data) {
      for (const callback of (this.listeners.get(name) || [])) callback(data);
    }
    send(raw) {
      const message = JSON.parse(raw);
      this.calls.push(message);
      const { requestType, requestId, requestData: data } = message.d;
      let responseData = {};
      if (requestType === "GetInputList") responseData = { inputs: this.inputs };
      else if (requestType === "GetSceneItemList") responseData = { sceneItems: this.sceneItems };
      else if (requestType === "CreateInput") {
        this.inputs.push({ inputName: data.inputName, inputKind: data.inputKind });
        this.sceneItems.push({ sourceName: data.inputName });
      } else if (requestType === "CreateSceneItem") {
        this.sceneItems.push({ sourceName: data.sourceName });
      }
      queueMicrotask(() => this.emit("message", {
        data: JSON.stringify({
          op: 7,
          d: { requestId, requestStatus: { result: true, code: 100 }, responseData }
        })
      }));
    }
    close() { this.readyState = 3; this.emit("close", {}); }
  }
  globalThis.WebSocket = FakeWebSocket;
  try {
    const socket = new FakeWebSocket();
    const obs = new ObsConnection(socket);
    const guests = [{ label: "Ana", streamId: "ana_123" }, { label: "Beto", streamId: "beto_456" }];
    const first = await obs.addGuests(room, "Câmeras do podcast", guests);
    assert.deepEqual(first, { created: 2, linked: 0, alreadyPresent: 0, failures: [] });
    const created = socket.calls.filter(m => m.d.requestType === "CreateInput");
    assert.equal(created.length, 2);
    assert.equal(created[0].d.requestData.inputKind, "browser_source");
    assert.equal(created[0].d.requestData.sceneName, "Câmeras do podcast");
    assert.equal(new URL(created[0].d.requestData.inputSettings.url).searchParams.get("view"), "ana_123");

    const second = await obs.addGuests(room, "Câmeras do podcast", guests);
    assert.deepEqual(second, { created: 0, linked: 0, alreadyPresent: 2, failures: [] });
    assert.equal(socket.calls.filter(m => m.d.requestType === "CreateInput").length, 2);
    socket.sceneItems.length = 0;
    const third = await obs.addGuests(room, "Cena alternativa", guests);
    assert.deepEqual(third, { created: 0, linked: 2, alreadyPresent: 0, failures: [] });
    assert.equal(socket.calls.filter(m => m.d.requestType === "CreateSceneItem").length, 2);
    obs.close();
  } finally { globalThis.WebSocket = original; }
});
