# AI Book Voice Chat

Upload a book, talk to it. Voice-only — no text input. Ask questions, get answers spoken back in a chosen voice.

## How it works

1. Upload a PDF book with a title, author, and preferred voice
2. The book is parsed, chunked, embedded, and stored in pgvector
3. Open a book and press record — speak your question
4. Your speech is transcribed → matched against the book's content → answered by Claude → spoken back

## Stack

| Layer | Tool |
|---|---|
| Frontend + Backend | Next.js (App Router) |
| Styling | Tailwind CSS + shadcn/ui |
| LLM | Claude Haiku (Anthropic) |
| Embeddings + Reranking | Voyage AI |
| DB + Auth + Storage | Supabase + pgvector |
| PDF Parsing | pdf-parse |
| Speech-to-Text | Deepgram (Nova-3) |
| Text-to-Speech | Deepgram (Aura-2) |
| Streaming | Vercel AI SDK |
| Deployment | Vercel |

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Set environment variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
VOYAGE_API_KEY=
DEEPGRAM_API_KEY=
```

### 3. Set up Supabase

Enable the `vector` extension and run the schema (see `supabase/schema.sql` when added).

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Cost to run

At testing scale (3-4 books, ~100 voice exchanges):

| Service | Cost |
|---|---|
| Deepgram STT + TTS | ~$0 (covered by $200 free credit) |
| Claude Haiku | ~$0.20 |
| Voyage AI | $0 (200M token free tier) |
| Supabase | $0 (free tier) |
| Vercel | $0 (hobby tier) |