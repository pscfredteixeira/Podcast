import test from "node:test";
import assert from "node:assert/strict";
import { HANDS_TTL_MS, makeHandSignal, getHandSignal, applyHandSignal, pruneHands } from "../src/handSignal.ts";

test("mãos são identificadas, limitadas e aceitam somente nosso canal", () => {
  const message = makeHandSignal("participantABC123", "Ana", true);
  assert.deepEqual(getHandSignal({ podcastHands: message }), message);
  assert.deepEqual(getHandSignal(message), message);
  assert.equal(getHandSignal({ podcastHands: { ...message, channel: "outra-app" } }), null);
  assert.equal(getHandSignal({ podcastHands: { ...message, raised: "yes" } }), null);
  assert.equal(getHandSignal({ podcastHands: { ...message, participantId: "../a" } }), null);
  assert.throws(() => makeHandSignal("1", "Ana", true));
  assert.equal(makeHandSignal("participantABC123", "x".repeat(140), true).name.length, 48);
});

test("levantar e baixar a mão aparece a outras pessoas, sem duplicatas", () => {
  const id = "participantABC123";
  const up = makeHandSignal(id, "Ana", true);
  const down = makeHandSignal(id, "Ana", false);
  const selfId = "myownparticipant123";
  const initial = applyHandSignal([], up, 1_000, selfId);
  assert.deepEqual(initial, [{ participantId: id, name: "Ana", seenAt: 1_000 }]);
  assert.deepEqual(applyHandSignal(initial, up, 2_000, selfId),
    [{ participantId: id, name: "Ana", seenAt: 2_000 }]);
  assert.deepEqual(applyHandSignal(initial, down, 3_000, selfId), []);
  assert.deepEqual(applyHandSignal(initial, up, 2_000, id), initial, "ignora eco do próprio participante");
});

test("mãos desaparecem após desconexão sem status atualizado", () => {
  const entry = [{ participantId: "participantABC123", name: "Ana", seenAt: 4_000 }];
  assert.equal(pruneHands(entry, 4_000 + HANDS_TTL_MS - 10).length, 1);
  assert.deepEqual(pruneHands(entry, 4_000 + HANDS_TTL_MS + 1), []);
});
