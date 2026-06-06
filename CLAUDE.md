@AGENTS.md

# Project: AI Book Voice Chat

An app where users upload books (PDF) and have voice-only conversations with them. No text input — the user speaks, the book answers in a chosen voice.

## Core Flow

- [x] 1. User uploads a PDF book
- [x] 2. PDF is downloaded server-side and parsed into raw text
- [x] 3. Text is chunked, embedded (Voyage AI), and stored in pgvector
- [x] 4. User opens a book and speaks a question
- [~] 5. Speech is transcribed — MediaRecorder → /api/transcribe (Deepgram REST) → text. VAD implemented but STT pipeline not producing transcript text yet (see In Progress)
- [~] 6. Transcription → embed → pgvector search → Voyage rerank → local LLM → answer bubble. Route exists, untested end-to-end
- [~] 7. Answer → Deepgram Aura-2 TTS → audio playback. Route exists, untested end-to-end

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
1. Voyage-4 embed the query
2. `match_book_chunks` RPC on Supabase (pgvector cosine similarity, top 20)
3. Voyage rerank-2 (top 5)
4. Local LLM inference (`Qwen3.6-35B-A3B-UD-Q4_K_XL` at `LOCAL_LLM_BASE_URL`)
5. Returns `{ answer: string }`
- Strips `<think>…</think>` blocks from Qwen3 output
- Uses `/no_think` system prompt prefix to suppress extended thinking

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

Mic button → `startRecording()` → `getUserMedia` → `startSession(stream)`:

```
startSession:
  - Creates MediaRecorder (audio/webm;codecs=opus), no timeslice
  - Sets up AudioContext AnalyserNode for VAD (voice activity detection)
  - VAD polls every 100ms, starts after VAD_START_DELAY (400ms) to let mic settle
  - Speech detected when RMS×100 > SPEECH_THRESHOLD (18) for >= SPEECH_MIN_MS (600ms)
  - After speech, silence of SILENCE_MS (2000ms) triggers recorder.stop()
  - recorder.onstop → sends full blob to /api/transcribe → on non-empty transcript:
      setMessages([...prev, { role: "user", text }])
      sendQuery(text) → /api/chat → answer bubble → /api/speak → Audio.play()
  - After onstop completes, calls startSession(stream) again for next utterance
```

UI bubbles:
- User messages: right-aligned, `bg-[#F5DEB3]` (wheat yellow)
- Book messages: left-aligned, `bg-[#EDE5D0]` (beige)
- Status bubble (right, italic, 50% opacity): shows "Listening…" / "Speaking…" / "Transcribing…"
- Thinking bubble (left, italic): shows "Thinking…" while /api/chat is in flight

## In Progress — STT Not Working

**Problem**: The mic button activates, status bubble shows "Listening…", but speech is never detected and/or transcript comes back empty. The user speaks but nothing is committed to the chat.

**What's been tried and ruled out**:
1. Browser WebSocket to Deepgram (`wss://api.deepgram.com`) → fails with 1006 (network blocks outgoing WebSocket on the school network)
2. Chrome Web Speech API → also uses WebSocket to Google servers, same block — just returns `no-speech` immediately
3. MediaRecorder with `timeslice` (3s chunks) → each non-first chunk is a headerless WebM frame; Deepgram returns 400 "corrupt or unsupported data"
4. Current approach: MediaRecorder without timeslice + AudioContext VAD → full blob sent on silence. `/api/transcribe` returns 200 but transcript is empty, or VAD never triggers

**Most likely remaining issues** (fix one at a time and test):
- A) VAD threshold tuning: `SPEECH_THRESHOLD = 18` may be too high for the user's mic. Try logging `rms` values every second to find the right threshold. Add `console.log("[vad] rms:", rms.toFixed(1))` inside the VAD interval.
- B) Empty transcript from Deepgram: the blob may be too short (< 1500 bytes size check), or Deepgram returns empty even with speech. Log `blob.size` and the raw Deepgram response in `/api/transcribe`.
- C) Stale closure: `startSession` calls itself recursively from `recorder.onstop`. React re-renders between sessions may cause the inner `startSession` reference to be stale. Consider using a `useCallback` with `useRef` wrapper, or extract to a plain function outside the component.
- D) AudioContext suspended: browsers require a user gesture to resume AudioContext. `new AudioContext()` created inside `startSession` (not inside the button click handler directly) may start in `suspended` state. Call `audioCtx.resume()` after creating it and await it before starting the VAD.

**Suggested next step**: Add the following debug logs and report back what you see:
```typescript
// In startVad, before the setInterval:
console.log("[vad] audioCtx state:", audioCtx.state);
await audioCtx.resume();
// Inside the setInterval callback:
if (Math.random() < 0.1) console.log("[vad] rms:", rms.toFixed(1));
```

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
- Local LLM at `loon.sccs.swarthmore.edu:11435` uses OpenAI-compatible API (`/v1/chat/completions`). Model `Qwen3.6-35B-A3B-UD-Q4_K_XL` is always loaded. Use `/no_think` in system prompt and strip `<think>` tags from output
- Voice IDs stored in DB (`rachel`, `sarah`, `dave`, `daniel`, `chris`) map to Deepgram Aura-2 models in `VOICE_MAP` inside `app/api/speak/route.ts`
- `NEXT_PUBLIC_DEEPGRAM_API_KEY` is set in `.env.local` but is no longer used (kept for reference). All Deepgram calls use server-only `DEEPGRAM_API_KEY`

## Not Started
- [ ] Stripe payments + pricing page + webhook handler
- [ ] Conversation history (store messages per book per user)
- [ ] Remove console.log debug statements from ChatUI once STT is confirmed working
