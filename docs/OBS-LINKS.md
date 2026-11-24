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
