import test from "node:test";
import assert from "node:assert/strict";
import { directorUrl, obsSoloUrl, parseGuestList } from "../src/obs.ts";

const room = "aulas-000102030405060708090a0b";

test("link de diretor e links individuais para OBS usam sala e streamID", () => {
  const d = new URL(directorUrl(room));
  assert.equal(d.origin, "https://vdo.ninja");
  assert.equal(d.searchParams.get("director"), room);
  assert.equal(d.searchParams.has("room"), false);

  const solo = new URL(obsSoloUrl(room, "aliceCam123"));
  assert.equal(solo.searchParams.get("room"), room);
  assert.equal(solo.searchParams.get("view"), "aliceCam123");
  assert.equal(solo.searchParams.has("solo"), true);
  assert.equal(solo.searchParams.has("push"), false);
  assert.throws(() => obsSoloUrl(room, "a&room=outro"));
  assert.throws(() => obsSoloUrl(room, "1"));
  assert.throws(() => directorUrl("room-invalido"));
});

test("lista de participantes do VDO reconhece IDs, remove repetições e ignora slots", () => {
  assert.deepEqual(parseGuestList([
    { streamID: "camAlice123", label: "Alice" },
    { id: "cameraBob_24", label: "Beto" },
    { streamId: "camAlice123", label: "Duplicado" },
    { id: 2, label: "slot numérico" },
    { id: "3", label: "número em string" },
    { streamID: "camEve77", label: "   " },
    { streamID: "x&scene", label: "Injeção" }
  ]), [
    { streamId: "camAlice123", label: "Alice" },
    { streamId: "cameraBob_24", label: "Beto" },
    { streamId: "camEve77", label: "Convidado 3" }
  ]);
  assert.deepEqual(parseGuestList({
    "1": { streamID: "cameraFred123", label: "Fred" },
    "2": { streamID: "cameraElton456", label: "Convidado" },
    "3": { streamID: "cameraFred123", label: "Duplicado" },
    "4": { streamID: "1234", label: "Slot numérico" }
  }), [
    { streamId: "cameraFred123", label: "Fred" },
    { streamId: "cameraElton456", label: "Convidado" }
  ]);
  assert.equal(parseGuestList(null), null);
  assert.deepEqual(parseGuestList([]), []);
});
