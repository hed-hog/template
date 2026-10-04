# Enviar arquivos pelas tools MCP

Escrito para: quem integra com o servidor MCP do Hub e para quem mantém as libraries que
expõem tools com anexo.

## O problema que isto resolve

Até aqui, a única forma de mandar um arquivo por uma tool MCP era emitir o conteúdo
inteiro em base64 dentro da chamada. Um PDF de 131 KB vira cerca de 175 mil caracteres —
acima do que o modelo consegue emitir numa resposta. Na prática só dava para anexar
arquivos de poucos KB.

Agora toda tool que recebe arquivo aceita **quatro origens**, e exatamente uma por
chamada. `fileBase64` continua funcionando como sempre funcionou.

## Qual caminho usar

| Origem | Quando | Teto |
|---|---|---|
| `fileId` | O arquivo já está no storage | `storage-max-size` |
| `uploadId` | O arquivo está no disco do cliente | `storage-max-size` |
| `fileUrl` | O arquivo está no SharePoint, Drive ou atrás de um link assinado | `storage-max-size` |
| `fileBase64` | Arquivo pequeno, até ~256 KB | limite de saída do modelo |

`storage-max-size` vale **10 MB** por padrão. A descrição antiga de
`finance.titles.attachments.add` anunciava ~37 MB, número derivado do
`api-body-size-limit`; ele nunca valeu, porque quem barra primeiro é o `storage-max-size`.

### 1. `fileId` — o caminho principal

Arquivo que já está no storage. O id vem de `core.files.list`, de qualquer
`attachments.list` (que sempre devolveu o `file_id`) ou de `core.files.upload.complete`.

```
finance.titles.attachments.add { titleId: 42, fileId: 1234 }
```

O arquivo precisa ter sido enviado por quem está chamando. Quem tem papel `admin` ou
`admin-access` usa qualquer um. Arquivo anterior a esta mudança não tem dono registrado e
só o administrador alcança — não dá para provar de quem ele é, e adivinhar a favor de
quem pede seria abrir exatamente a porta que a checagem fecha.

### 2. `uploadId` — arquivo no disco do cliente

Três passos, e o binário nunca entra na conversa:

```
core.files.create-upload-url { fileName: "nota.pdf", mimeType: "application/pdf", sizeBytes: 131072 }
  -> { uploadId: 9, url: "https://hub-api.hcode.com.br/file/upload/<token>", ... }

curl -X PUT --data-binary @nota.pdf -H "Content-Type: application/pdf" "<url>"

core.files.upload.complete { uploadId: 9 }   -> { fileId: 1234 }

finance.titles.attachments.add { titleId: 42, fileId: 1234 }
```

O token dura 15 minutos (`storage-upload-url-ttl`), serve uma vez só e vale para um único
upload. O tamanho declarado é conferido contra o que chegou.

Não é uma URL pré-assinada do bucket, e sim um endpoint da própria API. Nenhum dos cinco
providers de storage tem presign de escrita hoje, o provider `local` do dev não teria
caminho nenhum, e validar o mimetype pelo conteúdo só seria possível depois do objeto já
estar gravado. Os bytes ainda passam pela API — o que eles não fazem mais é passar pela
conversa, que era o problema.

### 3. `fileUrl` — o servidor baixa

```
finance.titles.attachments.add { titleId: 42, fileUrl: "https://contoso.sharepoint.com/..." }
```

Endereços privados, loopback, link-local e de metadados de nuvem são recusados, inclusive
quando um host público resolve para eles ou redireciona para eles. O operador pode
restringir ainda mais com a setting `mcp-file-url-allowed-hosts` (vazia = qualquer host
público).

### 4. `fileBase64` — só para arquivo pequeno

Continua aceito, com o mesmo comportamento de antes, junto com `fileName` e `mimeType`.
Acima de uns 256 KB o base64 não cabe na resposta do modelo.

### Upload em partes — último recurso

Para cliente MCP que não consegue fazer requisição HTTP:

```
core.files.upload.init   { fileName, mimeType, sizeBytes }  -> { uploadId, chunkBytes, totalChunks }
core.files.upload.append { uploadId, index: 0, chunkBase64 }
core.files.upload.append { uploadId, index: 1, chunkBase64 }
core.files.upload.complete { uploadId }                      -> { fileId }
```

O conteúdo ainda passa pela conversa, só fatiado — um arquivo de 10 MB dá mais de 150
chamadas. Prefira `core.files.create-upload-url` sempre que houver como fazer o PUT.

## Garantias que valem em todos os caminhos

- **Mimetype conferido pelo conteúdo**, não só pelo header. Um executável declarado como
  `application/pdf` é recusado, e declarar um formato de assinatura conhecida obriga o
  conteúdo a exibi-la. Formatos sem assinatura (CSV, OFX) seguem passando.
- **`storage-accept-mimetype` e `storage-max-size`** aplicados nas quatro origens.
- **`sha256` opcional**: quando informado, conteúdo que não bate é recusado.
- **Idempotência**: anexar o mesmo arquivo à mesma entidade duas vezes devolve o vínculo
  existente; repetir uma `idempotencyKey` devolve o mesmo upload.
- **Auditoria**: cada ingestão grava `MCP_FILE_INGEST` em `audit_log` com a modalidade
  usada, visível por `finance.audit-logs.list`.

## Tools afetadas

Passaram a aceitar as quatro origens:

- `finance.titles.attachments.add`
- `finance.statements.import`
- `finance.accounts-payable.installments.extract-from-file`
- `finance.accounts-receivable.installments.extract-from-file`
- `operations.projects.files.add`
- `operations.tasks.files.add`

Tools que pedem um `fileId` e antes não tinham como obtê-lo passam a funcionar sem
alteração própria: materiais de turma, avatar de pessoa do CRM e de instrutor, capa e
imagem de SEO de página do CMS, ícone de conquista, comprovante de reembolso, frame de
nota de aula e recursos de curso.

## Quem já integrava não precisa mudar nada

`fileBase64` com `fileName` e `mimeType` continua válido e com o mesmo comportamento.

## Correções que vieram junto

- `core.files.download-url` e `core.files.open-url` assinavam a URL sobre o basename do
  arquivo em vez da chave real no provider, e resolviam para `NoSuchKey` no S3.
- `core.files.list` devolvia todos os arquivos de todas as empresas, inclusive os
  gravados como privados; agora recorta por dono para quem não é administrador.
- `lms.instructors.update` não expunha `avatarId`, embora o DTO sempre o aceitasse — não
  havia como trocar a foto de um instrutor pelo MCP.
- `lms.courses.structure.resources.update` enviava `resources` onde o DTO espera
  `recursos`. Como o service trata a lista como autoritativa, a tool **apagava** os
  recursos do curso em vez de atualizá-los.
- O log de auditoria do MCP serializava o base64 inteiro para descartar quase tudo num
  corte de mil caracteres; agora o conteúdo é redigido antes, e o que fica no log são os
  argumentos que identificam a chamada.
