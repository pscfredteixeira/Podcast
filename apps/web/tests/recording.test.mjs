import test from "node:test";
import assert from "node:assert/strict";
import { podcastStudioUrl } from "../src/recording.ts";

const room = "aulas-000102030405060708090a0b";

test("o produtor abre Podcast Studio para a sala, sem inserir credenciais", () => {
  const url = new URL(podcastStudioUrl(room));
  assert.equal(url.origin, "https://vdo.ninja");
  assert.equal(url.searchParams.get("director"), room);
  assert.equal(url.searchParams.has("podcast"), true);
  assert.equal(url.searchParams.has("gdrive"), true);
  assert.equal(url.searchParams.has("dropbox"), false);
});

test("Dropbox é conectado manualmente no Studio sem expor token no link", () => {
  const url = new URL(podcastStudioUrl(room, "dropbox"));
  assert.equal(url.searchParams.get("director"), room);
  assert.equal(url.searchParams.has("podcast"), true);
  assert.equal(url.searchParams.has("gdrive"), false);
  assert.equal(url.searchParams.has("dropbox"), false);
  assert.throws(() => podcastStudioUrl("sala-invalida"));
});
