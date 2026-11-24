# Podcast Lab — estúdio remoto experimental

Esta é uma cópia **independente** do projeto [Aulas](https://github.com/pscfredteixeira/aulas), preservado sem alterações.

A proposta é adaptar a videochamada VDO.Ninja a um estúdio de podcast, com apresentador e convidados, layout do apresentador em destaque e, numa próxima etapa, controles de gravação e exportação de arquivos.

**Estado:** código audiovisual clonado; **a gravação nativa ainda não foi implementada**. No momento, use OBS para efetuar uma gravação real enquanto testamos a interface. O projeto começa sem conexão com a API nem com o Firestore do Aulas para manter o isolamento.

O site da cópia precisará do GitHub Pages habilitado para este repositório. O repositório atualmente se chama `Podcast` (maiúsculo); o endereço esperado será `https://pscfredteixeira.github.io/Podcast/`, não o `/podcast/` minúsculo até renomear o repositório.

## Fontes individuais para OBS — protótipo

O criador da sala já pode abrir um **Painel diretor** para consultar o VDO.Ninja e obter links SOLO de cada convidado. Copie os links para **Fontes de navegador do OBS Studio**, uma fonte por pessoa. O funcionamento automático com convidados reais ainda precisa ser validado em dois navegadores/dispositivos.

[Guia de uso e limitações](docs/OBS-LINKS.md).

## Próximas etapas

1. Adaptar o nome, textos e fluxo de entrada para **apresentador** e **convidado**.
2. Experimentar layout do VDO.Ninja com apresentador maior e convidados menores.
3. Definir a gravação de áudio/vídeo e arquivos exportáveis, com avisos de consentimento.
4. Testar desktop e iPhone; escolher servidor Render e Firebase *separados* apenas se necessário.
5. Validar a gravação de ponta a ponta antes de usar em episódios.

A cópia mantém os quizzes e as enquetes como base de código, mas **não afirma que a gravação já funciona**. Nenhuma credencial do Aulas foi transportada.

## Publicação estática de compatibilidade

O build de produção também é sincronizado para o arquivo `index.html` e a pasta `assets/` na raiz. Isso impede que o fluxo legado do GitHub Pages/Jekyll exiba um repositório de código no lugar do aplicativo. Os arquivos são gerados automaticamente no GitHub Actions; **não editar manualmente**.
