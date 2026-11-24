# Painel de produção — links individuais para OBS

## O que faz

O Podcast Lab agora oferece ao **criador da sala, na mesma aba do navegador**, a seção **Fontes individuais para o OBS**. Ao clicar em **Conectar painel diretor**, ele abre o VDO.Ninja no modo `?director=` e consulta a lista de participantes pela API de iframe oficial `postMessage({ action:"getGuestList" })`.

Para cada convidado que o VDO.Ninja identifique com um *stream ID* válido, o painel gera um endereço SOLO independente:

```text
https://vdo.ninja/?room=ID_DA_SALA&view=ID_DO_STREAM&solo=
```

Cada endereço pode ser colado em **OBS Studio → Fontes → + → Navegador → URL**. Crie uma fonte por convidado para editar as posições e gravar áudio/vídeo na composição final do OBS. O link SOLO é uma fonte de vídeo; **não é um arquivo gravado**.

## Teste

1. No [Podcast Lab](https://pscfredteixeira.github.io/Podcast/), clique em **Criar uma nova sala**, informe o nome e entre na chamada.
2. Copie o **convite de convidado** e entre na mesma sala usando **outro dispositivo**.
3. De volta ao computador de produção, desça até **Fontes individuais para o OBS** e clique em **Conectar painel diretor**.
4. Espere alguns segundos e clique em **Atualizar convidados** caso seja necessário.
5. Para cada participante identificado, copie o link e acrescente-o como fonte de navegador no OBS.
6. Inicie e interrompa a gravação **no OBS**, verificando o arquivo exportado.

O modo diretor exibe outra interface do VDO.Ninja: use fones, monitore eco e evite ativar seu microfone duas vezes.

## Enviar todos automaticamente para o OBS (novo)

O painel do Podcast Lab agora também pode criar todas as fontes de navegador no OBS
sem copiar e colar individualmente. Esse recurso usa o **OBS WebSocket 5.x**, integrado
ao OBS Studio 28 ou superior. Ele se conecta **somente ao OBS que está rodando no mesmo
computador**, em `127.0.0.1`, com a porta configurada pelo usuário (padrão 4455).

1. Abra o OBS Studio no computador e escolha **Ferramentas → Configurações do servidor WebSocket**.
2. Marque **Habilitar servidor WebSocket**, mantenha a autenticação ligada e use **Mostrar informações de conexão** para encontrar a porta e a senha.
3. No mesmo computador, abra o Podcast Lab, crie a sala e clique em **Conectar painel diretor**.
4. Peça aos convidados que entrem e habilitem a câmera; os IDs precisam aparecer na lista.
5. Na seção **Enviar todos diretamente para o OBS**, informe a porta e senha e clique **Conectar ao OBS**. O navegador pode solicitar permissão de acesso à rede local.
6. Selecione a cena do OBS. Clique em **Enviar N fonte(s) para o OBS**.
7. Confira as fontes dentro da cena do OBS, posicione-as como desejar e **comece a gravar no próprio OBS**.

Cada convidado vira uma fonte `browser_source` de 1280×720 apontando para seu SOLO LINK
`?room=...&view=...&solo`. O nome contém o identificador da sala e do stream.
Executar outra vez não duplica uma fonte que já esteja na cena. Se a mesma fonte existir
na coleção mas não estiver naquela cena, ela será vinculada à cena escolhida.

**O que o botão não faz:** não grava automaticamente, não inicia streaming, não altera
ou apaga outras cenas e não coloca os convidados automaticamente na posição ideal
dentro do quadro. Não use um mesmo microfone transmitindo duas vezes para evitar eco.
A senha do OBS é usada apenas no navegador para autenticar a conexão local; não é salva
em armazenamento local nem enviada ao backend.

**Limitação importante:** em alguns navegadores, uma página HTTPS não consegue abrir
`ws://127.0.0.1:4455` sem permissão de rede local, ou a conexão pode ser bloqueada.
O recurso foi validado por testes automatizados do protocolo, **não por um teste real
de OBS conectado neste ambiente**. Se o navegador bloquear, ainda é possível copiar
os SOLO LINKS e criá-los manualmente no OBS.

Referência do OBS: https://github.com/obsproject/obs-websocket
Referência do protocolo: https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md

## Limitações e segurança

- Esta versão é **experimental**: os testes automatizados validam a montagem e a segurança básica das URLs, mas ainda é necessário testar a lista de convidados em uma sessão VDO.Ninja real. O formato das respostas do iframe pode variar entre versões.
- O painel oferece um botão **Abrir diretor do VDO.Ninja em outra aba** como alternativa. No diretor nativo, cada convidado tem a opção **SOLO LINK**, que funciona independentemente do nosso leitor automático.
- O projeto ainda não tem backend nem autenticação própria. A identificação de produtor é **apenas local, na aba que criou a sala**; ela **não é proteção de acesso ao VDO.Ninja**. Não usar em sessões privadas ou confidenciais.
- Quando o VDO.Ninja gera stream IDs aleatórios, o link pode mudar se o convidado sair e entrar novamente. Para gravações recorrentes, podemos gerar convites individuais com IDs fixos (um por pessoa) na próxima iteração.
- Uma nova fonte de navegador do OBS exige capacidade de upload da pessoa transmitindo. Testar qualidade e rede antes de gravar.
- Não inserir o link do convidado com `&push=` no OBS; o OBS usa `&view=` para assistir.
- O Podcast Lab **não grava nem exporta arquivos por conta própria**. A gravação é feita no OBS. Informar os convidados e obter consentimento.

## Fontes oficiais

- https://docs.vdo.ninja/getting-started/rooms
- https://docs.vdo.ninja/guides/iframe-api-documentation/iframe-api-for-directors
- https://docs.vdo.ninja/guides/how-to-get-permanent-links
