import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  return NextResponse.json({ ok: true });
}
