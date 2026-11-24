# Podcast Lab — plano de gravação

## Objetivo

Construir uma versão independente do Aulas dedicada a gravações remotas de podcasts, entrevistas e videocasts. O repositório de origem `pscfredteixeira/aulas` não deve ser alterado por este projeto.

## Recursos planejados

- Estúdio para apresentador e convidados, com links simples, sem instalação.
- Layout de conversa com apresentador destacado e convidados em miniaturas, dependendo dos recursos do VDO.Ninja.
- Controles de início, pausa e encerramento da gravação **somente quando houver captura real de arquivo**.
- Aviso e consentimento de gravação antes de participar.
- Gravação de áudio/vídeo, exportação e conferência do arquivo de episódio.
- Compatibilidade testada no desktop e iPhone.

## Limitações atuais

A plataforma copiada usa VDO.Ninja para a chamada. Isso **não significa que esteja gravando**. Capturar um iframe de origem externa com todos os canais não é automático; será necessário escolher e validar uma arquitetura de gravação (OBS ou solução nativa com permissões, exportação e armazenamento), levando em conta limitações do Safari no iPhone.

O frontend do Podcast não foi conectado à API do Aulas e não usa seu Firebase; se necessário, configurar servidor e banco totalmente separados para proteger o projeto original. Jamais compartilhar credenciais privadas em arquivos versionados.

## Próximo incremento

Adaptar a sala ao fluxo **apresentador/convidado** e testar áudio/vídeo com VDO.Ninja. Só depois implementar os controles de gravação e exportação. Até a gravação nativa estar pronta, usar OBS no computador para registrar episódios reais.
