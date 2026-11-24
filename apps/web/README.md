# Podcast Lab — frontend experimental

Interface React/Vite clonada do Aulas para desenvolver o estúdio de podcast, sem afetar a versão original.

**Ainda não grava áudio nem vídeo.** O iframe VDO.Ninja suporta a transmissão, mas a captura/armazenamento de arquivos de convidados exige trabalho separado e testes com consentimento.

Neste estágio a publicação é uma **demonstração audiovisual sem API**, porque não reutilizamos o backend ou os segredos do Aulas.

Desenvolvedores podem executar `npm install`, `npm run test` e `npm run build`. Convidados não precisam instalar nada.

Projeto de origem: https://github.com/pscfredteixeira/aulas

## Publicação

A hospedagem GitHub Pages deve usar **Settings → Pages → Source: GitHub Actions**.
O workflow `.github/workflows/deploy-pages.yml` compila React/Vite em `apps/web/dist` e o publica em `/Podcast/`.
Se a página mostrar código ou README em vez da aplicação, verifique se o Pages não está implantando diretamente a branch `main` via Jekyll.
