@AGENTS.md

# Project: AI Book Voice Chat

An app where users upload books (PDF) and have voice-only conversations with them. No text input — the user speaks, the book answers in a chosen voice.

## Core Flow

1. User uploads a PDF book
2. The book is parsed, chunked, embedded, and stored in pgvector
3. User opens a book and speaks a question
4. Speech is transcribed (Deepgram)
5. Transcription is embedded → vector search → re-ranked → sent to Claude Haiku with context
6. Claude's answer is converted to speech (ElevenLabs) and played back

## Stack

| Layer | Tool |
|---|---|
| Frontend + Backend | Next.js (App Router) |
| Styling | Tailwind CSS + shadcn/ui |
| API Routes | Next.js Route Handlers (`/app/api/...`) |
| LLM | Claude API — Haiku for inference |
| Embeddings + Reranking | Voyage AI (`voyage-3-lite` + `rerank-2`) |
| DB + Auth + Storage | Supabase |
| Vector Store | Supabase pgvector |
| PDF Parsing | pdf-parse (npm) |
| Streaming | Vercel AI SDK (`useChat` hook) |
| Speech-to-Text | Deepgram |
| Text-to-Speech | Deepgram (Aura-2) |
| Deployment | Vercel |