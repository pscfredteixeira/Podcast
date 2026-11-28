/** Endpoint oficial do Podcast Studio do VDO.Ninja, sem credenciais na URL. */
const ROOM_PATTERN = /^aulas-[0-9a-f]{24}$/;
export type CloudProvider = "drive" | "dropbox";

export function podcastStudioUrl(room: string, cloud: CloudProvider = "drive"): string {
  if (!ROOM_PATTERN.test(room)) throw new Error("Código de sala inválido.");
  const url = new URL("https://vdo.ninja/");
  url.searchParams.set("director", room);
  // O modo Podcast Studio é o console de gravação nativo do VDO.Ninja;
  // nenhum parâmetro a seguir inicia a gravação sem ação do produtor.
  url.searchParams.set("podcast", "");
  if (cloud === "drive") url.searchParams.set("gdrive", "");
  // O Dropbox é conectado em Recording settings via OAuth no próprio Studio.
  return url.toString();
}
