import { VoyageAIClient } from "voyageai";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY });

const LLM_BASE = process.env.LOCAL_LLM_BASE_URL!;
const LLM_MODEL = process.env.LOCAL_LLM_MODEL!;

function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

// Split accumulated text on sentence boundaries. Returns [complete sentences, leftover].
function extractSentences(buf: string): [string[], string] {
  const sentences: string[] = [];
  const re = /[.?!]+\s+(?=[A-Z])/g;
  let last = 0;
  while (re.exec(buf) !== null) {
    const s = buf.slice(last, re.lastIndex).trim();
    if (s) sentences.push(s);
    last = re.lastIndex;
  }
  return [sentences, buf.slice(last)];
}

function sseStream(
  fn: (emit: (event: object) => void) => Promise<void>
): NextResponse {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      const emit = (event: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      try {
        await fn(emit);
      } finally {
        controller.close();
      }
    },
  });
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { book_id, query } = await req.json();
  if (!book_id || !query)
    return NextResponse.json({ error: "Missing book_id or query" }, { status: 400 });

  // 1. Embed
  const embedRes = await voyage.embed({ input: [query], model: "voyage-4" });
  const queryEmbedding = embedRes.data![0].embedding!;

  // 2. Vector search — top 20
  const { data: chunks, error: rpcError } = await supabase.rpc("match_book_chunks", {
    query_embedding: queryEmbedding,
    match_book_id: book_id,
    match_count: 20,
  });
  if (rpcError) return NextResponse.json({ error: rpcError.message }, { status: 500 });

  const FALLBACK = "I couldn't find any relevant passages in this book.";
  if (!chunks || chunks.length === 0) {
    return sseStream(async (emit) => {
      emit({ sentence: FALLBACK });
      emit({ done: true, answer: FALLBACK });
    });
  }

  // 3. Rerank — top 3
  const rerankRes = await voyage.rerank({
    query,
    documents: (chunks as { content: string }[]).map((c) => c.content),
    model: "rerank-2",
    topK: 3,
  });
  const topChunks = (rerankRes.data ?? []).map(
    (r) => (chunks as { content: string }[])[r.index!].content
  );

  // 4. LLM — streaming SSE
  const context = topChunks.join("\n\n---\n\n");
  const llmRes = await fetch(`${LLM_BASE}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: LLM_MODEL,
      max_tokens: 16384,
      stream: true,
      messages: [
        {
          role: "system",
          content:
            "You are the voice of a book speaking directly to a reader. Answer using only the excerpts provided. Be concise and conversational — your response will be read aloud.",
        },
        {
          role: "user",
          content: `/no_think\nBook excerpts:\n${context}\n\nQuestion: ${query}`,
        },
      ],
    }),
  });

  if (!llmRes.ok) {
    return NextResponse.json({ error: await llmRes.text() }, { status: 502 });
  }

  return sseStream(async (emit) => {
    const reader = llmRes.body!.getReader();
    const dec = new TextDecoder();
    let llmBuf = "";
    let textBuf = "";
    let fullAnswer = "";
    let inThink = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      llmBuf += dec.decode(value, { stream: true });
      const lines = llmBuf.split("\n");
      llmBuf = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") continue;

        let delta: { content?: string; reasoning_content?: string } | undefined;
        try {
          const parsed = JSON.parse(payload) as {
            choices: { delta: { content?: string; reasoning_content?: string } }[];
          };
          delta = parsed.choices[0]?.delta;
        } catch {
          continue;
        }

        // Skip reasoning-only tokens
        if (delta?.reasoning_content !== undefined && !delta.content) continue;

        let token = delta?.content ?? "";
        if (!token) continue;

        // Handle inline <think> tags as safety net
        if (token.includes("<think>")) inThink = true;
        if (token.includes("</think>")) {
          inThink = false;
          token = token.replace(/<\/think>/g, "");
        }
        if (inThink) continue;

        textBuf += token;
        const [sentences, remainder] = extractSentences(textBuf);
        textBuf = remainder;

        for (const s of sentences) {
          const clean = stripThinking(s);
          if (!clean) continue;
          fullAnswer += (fullAnswer ? " " : "") + clean;
          emit({ sentence: clean });
        }
      }
    }

    // Flush remainder
    const leftover = stripThinking(textBuf.trim());
    if (leftover) {
      fullAnswer += (fullAnswer ? " " : "") + leftover;
      emit({ sentence: leftover });
    }

    if (!fullAnswer) {
      emit({ sentence: FALLBACK });
      fullAnswer = FALLBACK;
    }

    emit({ done: true, answer: fullAnswer });
  });
}
