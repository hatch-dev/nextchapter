# RAG Chat (PHP + Flowise + Claude + Voyage AI + Pinecone)

A minimal, streaming AI chat app. **Flowise does all the RAG work** (embed the
question with Voyage AI, retrieve chunks from Pinecone, answer with Claude). This
PHP app is just:

- a **chat UI** (`index.html` + `assets/`), and
- a **server-side proxy** (`api/chat.php`) that streams responses from Flowise
  while keeping your Flowise URL and API key out of the browser.

```
Browser ──POST /api/chat.php──▶ PHP proxy ──POST /api/v1/prediction/{id}──▶ Flowise
                                                                              ├─ Voyage AI  (embed query)
                                                                              ├─ Pinecone   (retrieve chunks)
                                                                              └─ Claude     (generate answer)
```

Your Voyage / Pinecone / Anthropic keys live **inside Flowise**, not here.

---

## 1. Build the chatflow in Flowise (one-time)

Open Flowise at `http://localhost:3000` → **Add New** chatflow, then drag in and
connect these nodes:

1. **Chat Model → ChatAnthropic**
   - Anthropic API key: your key
   - Model: `claude-opus-4-8` (or `claude-sonnet-5` for lower cost)
   - **Enable "Streaming"** (needed for live token output in this app)
2. **Embeddings → VoyageAI Embeddings**
   - Voyage API key: your key
   - Model: e.g. `voyage-3` (must match the dimension of your Pinecone index)
3. **Vector Store → Pinecone**
   - Pinecone API key + Index name
   - Connect the **VoyageAI Embeddings** node into it
4. **Document Loaders + Text Splitter** (to ingest your files)
   - Add a loader (PDF / Text / Docx / Folder), connect a **Recursive Character
     Text Splitter**, and feed it into the Pinecone node's *Document* input.
5. **Chain → Conversational Retrieval QA Chain**
   - Connect **ChatAnthropic** as the model and **Pinecone** as the retriever.
   - (Optional) add a **Memory** node so follow-up questions keep context.

Then:
- Click **Upsert / Save** so your documents get embedded into Pinecone.
- **Save** the chatflow.

> ⚠️ Pinecone index dimension must equal your Voyage model's output dimension
> (e.g. `voyage-3` = 1024). Create the index with the right dimension first.

## 2. Get the chatflow ID (and API key, if any)

- Open the chatflow → top-right **API Endpoint** / **`</>`** icon.
- Copy the ID from the URL: `.../api/v1/prediction/<THIS_IS_THE_ID>`.
- If you added an API key in Flowise, copy that too.

## 3. Configure this app

```bash
cd c:\xampp\htdocs\pipeline\enterprises\rag-chat
copy config.local.example.php config.local.php
```

Edit `config.local.php`:

```php
return [
    'flowise_base_url'    => 'http://localhost:3000',
    'flowise_chatflow_id' => 'paste-your-chatflow-id',
    'flowise_api_key'     => '',   // only if the chatflow requires one
];
```

`config.local.php` is gitignored, so your keys stay out of version control.

## 4. Run

With XAMPP's Apache running, open:

```
http://localhost/pipeline/enterprises/rag-chat/
```

Ask a question — the answer streams in token-by-token, with a **Sources**
dropdown when Flowise returns the retrieved chunks.

---

## How it works

- `api/chat.php` receives `{question, sessionId}`, forwards it to Flowise with
  `"streaming": true`, and pipes Flowise's SSE stream straight back to the
  browser (using cURL's `WRITEFUNCTION` + `flush()`).
- `assets/app.js` reads the response as a stream and parses SSE events
  (`token`, `sourceDocuments`, `end`, `error`). It handles both Flowise SSE
  shapes and falls back to plain JSON if streaming happens to be off.
- `sessionId` (a UUID in `localStorage`) is passed as
  `overrideConfig.sessionId` so Flowise can keep conversation memory. "New chat"
  clears it.

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Answer appears all at once, not streaming | Enable **Streaming** on the ChatAnthropic node in Flowise. |
| `Could not reach Flowise` | Wrong `flowise_base_url`, or Flowise not running on port 3000. |
| `Flowise returned HTTP 401/403` | Chatflow needs an API key — set `flowise_api_key`. |
| `HTTP 404` | Wrong `flowise_chatflow_id`. |
| Empty / irrelevant answers | Documents weren't upserted to Pinecone, or index dimension ≠ Voyage model dimension. |
| No "Sources" shown | The chain isn't returning `sourceDocuments`; use the Conversational Retrieval QA Chain and enable "Return Source Documents". |

## Files

```
rag-chat/
├─ index.html              # chat UI
├─ config.php              # base config (loads config.local.php)
├─ config.local.example.php# template for your secrets
├─ api/chat.php            # streaming proxy to Flowise
└─ assets/
   ├─ style.css
   └─ app.js               # streaming SSE client
```
