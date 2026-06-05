@AGENTS.md

# Project: AI Book Voice Chat

An app where users upload books (PDF) and have voice-only conversations with them. No text input — the user speaks, the book answers in a chosen voice.

## Core Flow

- [x] 1. User uploads a PDF book
- [x] 2. PDF is downloaded server-side and parsed into raw text
- [x] 3. Text is chunked, embedded (Voyage AI), and stored in pgvector
- [ ] 4. User opens a book and speaks a question
- [ ] 5. Speech is transcribed (Deepgram)
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

## Implementation Notes

- Voyage API batch limit is 1000 chunks per request — embed and insert in batches of 1000
- Supabase PostgREST times out on large bulk inserts — also insert `book_chunks` in batches of 1000
- `books.file_path` stores the storage path (e.g. `{user_id}/{timestamp}.pdf`), not a public URL
- `books.cover_path` stores the storage path (e.g. `{user_id}/{timestamp}`)
- Auth is always resolved server-side in route handlers via `supabase.auth.getUser()` — never trust client-sent user IDs
- On any failure after `books` insert, delete the book row to avoid orphaned records

## Not Started
- [ ] `/app/book/[id]` chat page
- [ ] Microphone recording UI ("Press to Talk")
- [ ] `/api/transcribe` — Deepgram Nova STT
- [ ] `/api/chat` — embed query → pgvector search → Voyage rerank → Claude Haiku
- [ ] `/api/speak` — Deepgram Aura-2 TTS, stream audio back
- [ ] Audio playback in the browser
- [ ] Stripe payments + pricing page + webhook handler
- [ ] Conversation history (store messages per book per user)