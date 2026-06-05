import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PDFParse } from "pdf-parse";
import path from "path";
import { pathToFileURL } from "url";

PDFParse.setWorker(
  pathToFileURL(
    path.join(process.cwd(), "node_modules/pdf-parse/dist/pdf-parse/esm/pdf.worker.mjs")
  ).href
);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { pdfPath } = await request.json();
  const { data, error } = await supabase.storage
    .from("book_pdf")
    .download(`${pdfPath}`);
  if (error) {
    console.error(`Loading a book ${pdfPath} has failed from book_pdf storage`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const buffer = Buffer.from(await data.arrayBuffer());
  const parser = new PDFParse({ data: buffer });
  const { text } = await parser.getText();
  console.log(text);

  return NextResponse.json({ ok: true });
}
