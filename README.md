# AI Book Voice Chat

Upload a book, talk to it. Voice-only — no text input. Ask questions, get answers spoken back in a chosen voice.

## How it works

1. Upload a PDF book with a title, author, and preferred voice
2. The book is parsed, chunked, embedded (Voyage AI), and stored in Supabase pgvector
3. Open a book and press the mic button — speak your question
4. Your speech is transcribed server-side via Deepgram nova-2
5. The transcript is embedded, matched against the book via cosine similarity, reranked, and sent to a local Qwen3 LLM
6. The answer streams back sentence by sentence, each converted to speech via Deepgram Aura-2 and played immediately

## Stack

| Layer | Tool |
|---|---|
| Frontend + Backend | Next.js (App Router) |
| Styling | Tailwind CSS + shadcn/ui |
| LLM | Local Qwen3.6-35B (OpenAI-compatible, self-hosted) |
| Embeddings + Reranking | Voyage AI (`voyage-4`, `rerank-2`) |
| DB + Auth + Storage | Supabase + pgvector |
| PDF Parsing | pdf-parse |
| Speech-to-Text | Deepgram (Nova-2) |
| Text-to-Speech | Deepgram (Aura-2) |
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
VOYAGE_API_KEY=
DEEPGRAM_API_KEY=
LOCAL_LLM_BASE_URL=http://your-llm-host:port
LOCAL_LLM_MODEL=your-model-name
```

### 3. Set up Supabase

Enable the `vector` extension, create the tables (`users`, `books`, `book_chunks`), and create the `match_book_chunks` RPC function (see CLAUDE.md for the full SQL).

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Cost to run

At testing scale (~100 voice exchanges):

| Service | Cost |
|---|---|
| Deepgram STT + TTS | ~$0 (covered by $200 free credit) |
| Voyage AI | $0 (200M token free tier) |
| Supabase | $0 (free tier) |
| Vercel | $0 (hobby tier) |
| LLM | $0 (self-hosted) |
