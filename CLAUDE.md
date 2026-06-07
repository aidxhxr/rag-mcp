@AGENTS.md

# Project: AI Book Voice Chat

An app where users upload books (PDF) and have voice-only conversations with them. No text input — the user speaks, the book answers in a chosen voice.

## Core Flow

- [x] 1. User uploads a PDF book
- [x] 2. PDF is downloaded server-side and parsed into raw text
- [x] 3. Text is chunked, embedded (Voyage AI), and stored in pgvector
- [x] 4. User opens a book and speaks a question
- [x] 5. Speech is transcribed — MediaRecorder → /api/transcribe (Deepgram nova-2 REST) → text
- [x] 6. Transcription → embed → pgvector search → Voyage rerank → local LLM (streaming SSE) → answer bubble
- [x] 7. Answer → Deepgram Aura-2 TTS (per sentence, concurrent fetches) → audio playback
- [ ] Stripe payments + pricing page + webhook handler
- [ ] Conversation history (store messages per book per user)

## Stack

| Layer | Tool |
|---|---|
| Frontend + Backend | Next.js (App Router) |
| Styling | Tailwind CSS + shadcn/ui |
| API Routes | Next.js Route Handlers (`/app/api/...`) |
| LLM | Local Qwen3.6-35B at `http://loon.sccs.swarthmore.edu:11435` (OpenAI-compatible) |
| Embeddings | Voyage AI `voyage-4` |
| Reranking | Voyage AI `rerank-2` |
| DB + Auth + Storage | Supabase |
| Vector Store | Supabase pgvector |
| PDF Parsing | pdf-parse (npm) |
| Speech-to-Text | Deepgram nova-2 (server-side REST via `/api/transcribe`) |
| Text-to-Speech | Deepgram Aura-2 (server-side REST via `/api/speak`) |
| Payments + Subscriptions | Stripe (not yet started) |
| Deployment | Vercel |

## Database Schema

### `users`
| column | type |
|---|---|
| id | uuid (FK → auth.users.id) |
| email | text |
| name | text |
| stripe_consumer_id | text |
| plan | text |

### `books`
| column | type |
|---|---|
| id | uuid |
| user_id | uuid (FK → users.id) |
| file_path | text (path in `book_pdf` storage bucket) |
| cover_path | text (path in `book_image` storage bucket) |
| title | text |
| author | text |
| voice_id | text (one of: `rachel`, `sarah`, `dave`, `daniel`, `chris`) |
| created_at | timestamptz |

### `book_chunks`
| column | type |
|---|---|
| id | uuid |
| book_id | uuid (FK → books.id) |
| content | text |
| embedding | vector (voyage-4 dimensions) |

## API Routes

### `POST /api/transcribe`
Receives a raw audio Blob (audio/webm or audio/webm;codecs=opus), sends to Deepgram nova-2 REST API server-side, returns `{ transcript: string }`.
- Uses `DEEPGRAM_API_KEY` (server-only, not `NEXT_PUBLIC_`)
- Implemented in `app/api/transcribe/route.ts` with raw fetch (no SDK)

### `POST /api/chat`
Body: `{ book_id: string, query: string }`  
Returns: `text/event-stream` SSE with events `{ sentence: string }` and a final `{ done: true, answer: string }`

1. Voyage-4 embed the query
2. `match_book_chunks` RPC on Supabase (pgvector cosine similarity, top 20)
3. Voyage rerank-2 (top 3)
4. Local LLM inference (`Qwen3.6-35B-A3B-UD-Q4_K_XL` at `LOCAL_LLM_BASE_URL`) — streamed
5. Sentence boundaries detected server-side; each sentence emitted as an SSE event
6. Final `{ done: true, answer: "<full text>" }` event closes the stream

- `/no_think` in the **user** message (not system) to suppress Qwen3 extended thinking
- Strips `<think>…</think>` inline tags as a safety net
- Skips `reasoning_content` deltas (Qwen3's API-level thinking field)
- Falls back to last paragraph of `reasoning_content` if `content` is empty

### `POST /api/speak`
Body: `{ text: string, voice_id: string }`
- Maps app voice IDs → Deepgram Aura-2 model names (see `VOICE_MAP` in route)
- Streams audio/mpeg back from Deepgram TTS REST API
- Implemented in `app/api/speak/route.ts`

## Supabase pgvector RPC (must exist in DB)
```sql
create or replace function match_book_chunks(
  query_embedding vector,
  match_book_id uuid,
  match_count int default 20
)
returns table (id uuid, content text, similarity float)
language sql stable as $$
  select id, content, 1 - (embedding <=> query_embedding) as similarity
  from book_chunks
  where book_id = match_book_id
  order by embedding <=> query_embedding
  limit match_count;
$$;
```
This function has been created in Supabase already.

## ChatUI Architecture (`app/books/[book_id]/ChatUI.tsx`)

Mic button → `startRecording()` → `getUserMedia` (AGC/noise-suppression/echo-cancellation OFF) → `startSession(stream)`:

```
startSession:
  - Creates MediaRecorder (audio/webm;codecs=opus), no timeslice
  - Sets up AudioContext AnalyserNode for VAD (voice activity detection)
  - VAD polls every 100ms, starts after VAD_START_DELAY (400ms) to let mic settle
  - AudioContext.resume() called before VAD starts (required on some browsers)
  - Speech detected when RMS×100 > SPEECH_THRESHOLD (5) for >= SPEECH_MIN_MS (600ms)
  - speechStart timer does NOT reset on brief dips below threshold (normal between words)
  - After speech, silence of SILENCE_MS (2000ms) triggers recorder.stop()
  - recorder.onstop → sends full blob to /api/transcribe → on non-empty transcript:
      await sendQuery(text) → streams /api/chat SSE → concurrent TTS fetches per sentence
                           → plays audio in order → restarts session
  - startSession(stream) is called again only AFTER sendQuery fully resolves
    (so mic never overlaps with model thinking or speaking)
```

### `sendQuery` streaming pipeline
```
fetch /api/chat (SSE stream)
  → on each { sentence } event:
      - fire fetch /api/speak immediately (concurrent, non-blocking)
      - set isThinking=false, interimText="Speaking…" on first sentence
  → on { done } event: capture fullAnswer
after stream ends:
  → play audio blobs in order (each await-ed sequentially)
  → add book message bubble with fullAnswer
  → clear interimText
  → startSession restarts listening
```

UI bubbles:
- User messages: right-aligned, `bg-[#F5DEB3]` (wheat yellow)
- Book messages: left-aligned, `bg-[#EDE5D0]` (beige)
- Status bubble (right, italic, 50% opacity): shows "Listening…" / "Speaking…" / "Transcribing…"
  - Hidden while `isThinking` is true (so "Listening…" doesn't show during model inference)
- Thinking bubble (left, italic): shows "Thinking…" while waiting for first SSE sentence

## Known Issues / In Progress

- **Qwen3 extended thinking**: The model at `loon.sccs.swarthmore.edu:11435` ignores `think: false` on the OpenAI-compatible endpoint and continues to generate `reasoning_content`. `/no_think` in the user message partially helps but the model may still think for a long time before producing `content`. The Ollama native `/api/chat` endpoint returns 404 on this server.
  - Workaround: `max_tokens: 16384` gives enough budget for the model to finish reasoning and write content. `reasoning_content` deltas are skipped server-side.
  - If `content` is still empty after full stream, the last paragraph of `reasoning_content` is used as fallback.

## Implementation Notes

- Voyage API batch limit is 1000 chunks per request — embed and insert in batches of 1000
- Supabase PostgREST times out on large bulk inserts — also insert `book_chunks` in batches of 1000
- `books.file_path` stores the storage path (e.g. `{user_id}/{timestamp}.pdf`), not a public URL
- `books.cover_path` stores the storage path (e.g. `{user_id}/{timestamp}`) — no file extension
- Auth is always resolved server-side in route handlers via `supabase.auth.getUser()` — never trust client-sent user IDs
- On any failure after `books` insert, delete the book row to avoid orphaned records
- Cover images are served via signed URLs (`createSignedUrl` / `createSignedUrls`), not public URLs — Supabase domain is not in `next.config.ts` remotePatterns, so use `<img>` not `<Image>`
- Never create the Supabase browser client at module scope — always create it inside the function/hook to avoid stale auth state and repeated requests
- Always use `router.push()` from `next/navigation` for client-side navigation — never `window.location.href`, which bypasses Next.js router state and can cause repeated GET requests in dev mode
- The chat page layout uses `h-[calc(100dvh-60px)] flex flex-col overflow-hidden` — the chat area needs `flex-1 min-h-0 overflow-y-auto` (`min-h-0` is required or flex won't shrink the area)
- **Do NOT use Deepgram browser WebSocket** — the school network blocks outgoing WebSocket connections to external hosts (1006 close, no reason). All Deepgram calls must be server-side via HTTPS REST
- **Do NOT use Chrome Web Speech API** — also routed through Google WebSocket servers, same block
- **MediaRecorder timeslice is broken for Deepgram**: chunks after the first lack the WebM header — Deepgram returns 400. Always record as one continuous blob and send on stop
- **getUserMedia must disable browser audio processing**: `echoCancellation: false, noiseSuppression: false, autoGainControl: false` — without this, AGC compresses the mic signal so much that VAD RMS values stay near zero even during speech
- Local LLM at `loon.sccs.swarthmore.edu:11435` uses OpenAI-compatible API (`/v1/chat/completions`). Model `Qwen3.6-35B-A3B-UD-Q4_K_XL` is always loaded. Put `/no_think` at the start of the **user** message (not system prompt) to suppress extended thinking
- Voice IDs stored in DB (`rachel`, `sarah`, `dave`, `daniel`, `chris`) map to Deepgram Aura-2 models in `VOICE_MAP` inside `app/api/speak/route.ts`
- `NEXT_PUBLIC_DEEPGRAM_API_KEY` is set in `.env.local` but is no longer used (kept for reference). All Deepgram calls use server-only `DEEPGRAM_API_KEY`
- `/api/chat` returns `text/event-stream` SSE, not JSON — the client must read it as a stream, not `res.json()`