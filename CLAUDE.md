@AGENTS.md

# Project: AI Book Voice Chat

An app where users upload books (PDF) and have voice-only conversations with them. No text input — the user speaks, the book answers in a chosen voice.

## Core Flow

- [x] 1. User uploads a PDF book
- [x] 2. PDF is downloaded server-side and parsed into raw text
- [x] 3. Text is chunked, embedded (Voyage AI), and stored in pgvector
- [x] 4. User opens a book and speaks a question (mic UI built, recording wired up)
- [~] 5. Speech is transcribed (Deepgram) — browser WebSocket implemented, debugging in progress
- [ ] 6. Transcription is embedded → vector search → re-ranked → sent to Claude Haiku with context
- [ ] 7. Claude's answer is converted to speech (Deepgram Aura-2) and played back

## Stack

| Layer | Tool |
|---|---|
| Frontend + Backend | Next.js (App Router) |
| Styling | Tailwind CSS + shadcn/ui |
| API Routes | Next.js Route Handlers (`/app/api/...`) |
| LLM | Claude API — Haiku for inference |
| Embeddings + Reranking | Voyage AI (`voyage-4` + `rerank-2`) |
| DB + Auth + Storage | Supabase |
| Vector Store | Supabase pgvector |
| PDF Parsing | pdf-parse (npm) |
| Streaming | Vercel AI SDK (`useChat` hook) |
| Speech-to-Text | Deepgram |
| Text-to-Speech | Deepgram (Aura-2) |
| Payments + Subscriptions | Stripe (`stripe` + `@stripe/stripe-js`) |
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
| voice_id | text |
| created_at | timestamptz |

### `book_chunks`
| column | type |
|---|---|
| id | uuid |
| book_id | uuid (FK → books.id) |
| content | text |
| embedding | vector |

## Status

### Done
- [x] Google/GitHub OAuth (Supabase)
- [x] Middleware auth protection
- [x] Home page (book library UI)
- [x] New book upload form (PDF + cover + title + author + voice)
- [x] Supabase Storage buckets (`book_pdf`, `book_image`) with RLS policies
- [x] Upload PDF + cover to Supabase Storage from client
- [x] `/api/upload` route — downloads PDF from storage, parses text with pdf-parse
- [x] Chunking parsed text (sliding window, ~500 tokens, 50-token overlap)
- [x] Voyage AI embeddings (`voyage-4`) per chunk
- [x] Store chunks + vectors in pgvector (`book_chunks` table)
- [x] Insert book metadata into `books` DB table after upload
- [x] Redirect to book page after successful upload
- [x] Home page loads real books from Supabase (filtered by user_id, batch signed cover URLs)
- [x] `/app/books/[book_id]` chat page — server fetches book + signed cover URL, passes to `ChatUI`
- [x] `ChatUI` client component — book header, chat bubble area, mic button pinned at bottom center
- [x] `ChatUI` mic recording — `getUserMedia` + `MediaRecorder` (250ms chunks, `audio/webm;codecs=opus`)
- [x] `ChatUI` Deepgram live transcription — browser-side WebSocket via `@deepgram/sdk` `client.listen.v1.connect()`
- [x] `ChatUI` interim transcript display — faded italic bubble updates in real time while speaking
- [x] `ChatUI` final transcript → user message bubble on mic stop
- [x] `/api/transcribe` — server-side pre-recorded transcription via `client.listen.v1.media.transcribeFile()`, returns `{ transcript }`

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
- Deepgram SDK (`@deepgram/sdk` v4): use `DeepgramClient` (exported as `CustomDeepgramClient`), connect with `client.listen.v1.connect(args)` — returns a `V1Socket` with `.on(event, handler)` and `.sendMedia(blob)`
- **Deepgram browser WebSocket auth**: browsers cannot send custom HTTP headers in WebSocket handshakes — the `Authorization` header in `ConnectArgs` is silently dropped. Must pass `queryParams: { token: apiKey }` so the key is appended as `?token=...` in the URL
- Deepgram `ConnectArgs` boolean-like fields (`interim_results`, `smart_format`, `punctuate`, `vad_events`) are typed as `string`, not `boolean` — pass `"true"` not `true`
- `NEXT_PUBLIC_DEEPGRAM_API_KEY` must be set in `.env.local` (even if `DEEPGRAM_API_KEY` is also set) — the browser cannot read non-`NEXT_PUBLIC_` env vars
- `V1Socket.readyState` returns `3` (CLOSED) immediately after `client.listen.v1.connect()` resolves — this is expected, the underlying WebSocket connects asynchronously. Wait for the `open` event before treating the socket as ready; guard `sendMedia` calls with `readyState === 1`
- `/api/transcribe` is a server-side fallback using the pre-recorded REST API — it is **not** used by `ChatUI`, which does live browser-side streaming instead

## In Progress
- [ ] Deepgram browser WebSocket connection: `readyState` stays `3`, `open` event never fires — a raw `new WebSocket(wss://api.deepgram.com/v1/listen?model=nova-3&token=KEY)` test has been added to `ChatUI` to determine if the issue is SDK-level or network/auth-level. Remove the raw test once resolved.

## Not Started
- [ ] `/api/chat` — embed query → pgvector search → Voyage rerank → Claude Haiku
- [ ] `/api/speak` — Deepgram Aura-2 TTS, stream audio back
- [ ] Remove debug console logs and raw WebSocket test from `ChatUI` once transcription is confirmed working
- [ ] Audio playback in the browser
- [ ] Stripe payments + pricing page + webhook handler
- [ ] Conversation history (store messages per book per user)