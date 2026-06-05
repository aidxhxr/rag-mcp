import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import ChatUI from "./ChatUI";

type Props = { params: Promise<{ book_id: string }> };

export default async function BookPage({ params }: Props) {
  const { book_id } = await params;
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen text-[#8a8a8a]">Loading…</div>}>
      <Content book_id={book_id} />
    </Suspense>
  );
}

async function Content({ book_id }: { book_id: string }) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: book } = await supabase
    .from("books")
    .select("id, title, author, cover_path, voice_id")
    .eq("id", book_id)
    .eq("user_id", user.id)
    .single();

  if (!book) notFound();

  const { data: signed } = await supabase.storage
    .from("book_image")
    .createSignedUrl(book.cover_path, 3600);

  return (
    <ChatUI
      book={{
        id: book.id,
        title: book.title,
        author: book.author,
        voiceId: book.voice_id,
        coverUrl: signed?.signedUrl ?? null,
      }}
    />
  );
}
