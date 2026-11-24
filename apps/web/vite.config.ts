import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // GitHub Pages publica o projeto no caminho do repositório Podcast (P maiúsculo).
  // Em desenvolvimento local, o site continua na raiz (/).
  base: command === "build" ? "/Podcast/" : "/",
}));
