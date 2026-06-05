import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { VoyageAIClient } from "voyageai";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PDFParse } from "pdf-parse";
import path from "path";
import { pathToFileURL } from "url";

PDFParse.setWorker(
  pathToFileURL(
    path.join(
      process.cwd(),
      "node_modules/pdf-parse/dist/pdf-parse/esm/pdf.worker.mjs",
    ),
  ).href,
);

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 50,
});

const client = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY });

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pdfPath, coverPath, title, author, voiceId } = await request.json();

  await supabase.from("users").upsert({ id: user.id, email: user.email });

  const { data: book, error: bookError } = await supabase
    .from("books")
    .insert({ user_id: user.id, title, author, voice_id: voiceId, file_path: pdfPath, cover_path: coverPath })
    .select("id")
    .single();
  if (bookError) return NextResponse.json({ error: bookError.message }, { status: 500 });

  const { data, error } = await supabase.storage
    .from("book_pdf")
    .download(pdfPath);
  if (error) {
    await supabase.from("books").delete().eq("id", book.id);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  const parser = new PDFParse({ data: buffer });
  const { text } = await parser.getText();

  const stringChunks = await splitter.splitText(text);

  const BATCH_SIZE = 1000;
  const embeddings: number[][] = [];
  for (let i = 0; i < stringChunks.length; i += BATCH_SIZE) {
    const batch = stringChunks.slice(i, i + BATCH_SIZE);
    const res = await client.embed({ input: batch, model: "voyage-4" });
    embeddings.push(...res.data!.map((d) => d.embedding!));
  }

  const rows = stringChunks.map((chunk, i) => ({
    book_id: book.id,
    content: chunk,
    embedding: embeddings[i],
  }));

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const { error: chunksError } = await supabase
      .from("book_chunks")
      .insert(rows.slice(i, i + BATCH_SIZE));
    if (chunksError) {
      await supabase.from("books").delete().eq("id", book.id);
      return NextResponse.json({ error: chunksError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, bookId: book.id });
}
