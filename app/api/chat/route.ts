import { VoyageAIClient } from "voyageai";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY });

const LLM_BASE = process.env.LOCAL_LLM_BASE_URL!;
const LLM_MODEL = process.env.LOCAL_LLM_MODEL!;

// Strip <think>…</think> blocks from Qwen3's extended-thinking mode
function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { book_id, query } = await req.json();
  if (!book_id || !query) {
    return NextResponse.json({ error: "Missing book_id or query" }, { status: 400 });
  }

  // 1. Embed the query (must match the model used when chunking)
  const embedRes = await voyage.embed({ input: [query], model: "voyage-4" });
  const queryEmbedding = embedRes.data![0].embedding!;

  // 2. Vector search — top 20 chunks
  const { data: chunks, error: rpcError } = await supabase.rpc(
    "match_book_chunks",
    { query_embedding: queryEmbedding, match_book_id: book_id, match_count: 20 }
  );
  if (rpcError) return NextResponse.json({ error: rpcError.message }, { status: 500 });
  if (!chunks || chunks.length === 0) {
    return NextResponse.json({
      answer: "I couldn't find any relevant passages in this book.",
    });
  }

  // 3. Rerank — top 5 via Voyage AI
  const rerankRes = await voyage.rerank({
    query,
    documents: (chunks as { content: string }[]).map((c) => c.content),
    model: "rerank-2",
    topK: 5,
  });
  const topChunks = (rerankRes.data ?? []).map(
    (r: { index: number }) => (chunks as { content: string }[])[r.index].content
  );

  // 4. Local LLM inference — Qwen3.6-35B
  const context = topChunks.join("\n\n---\n\n");
  const llmRes = await fetch(`${LLM_BASE}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: LLM_MODEL,
      max_tokens: 4096,
      messages: [
        {
          // /no_think suppresses Qwen3's extended-thinking mode
          role: "system",
          content:
            "/no_think\nYou are the voice of a book speaking directly to a reader. Answer using only the excerpts provided. Be concise and conversational — your response will be read aloud.",
        },
        {
          role: "user",
          content: `Book excerpts:\n${context}\n\nQuestion: ${query}`,
        },
      ],
    }),
  });

  if (!llmRes.ok) {
    return NextResponse.json({ error: await llmRes.text() }, { status: 502 });
  }

  const llmData = (await llmRes.json()) as {
    choices: { finish_reason: string; message: { content: string; reasoning_content?: string } }[];
  };
  const choice = llmData.choices[0];
  if (choice?.finish_reason === "length") {
    console.warn("[chat] hit max_tokens during reasoning — reasoning_content length:", choice.message.reasoning_content?.length ?? 0);
  }
  const raw = choice?.message?.content ?? "";
  const answer = stripThinking(raw);

  return NextResponse.json({ answer: answer || "I'm not sure — I couldn't find a clear answer in this book." });
}
