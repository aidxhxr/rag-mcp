import Link from "next/link";
import { howItWorks } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: books } = await supabase
    .from("books")
    .select("id, title, author, cover_path")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const coverPaths = (books ?? []).map((b) => b.cover_path);
  const { data: signedUrls } = coverPaths.length
    ? await supabase.storage.from("book_image").createSignedUrls(coverPaths, 3600)
    : { data: [] };

  const coverUrlMap = Object.fromEntries(
    (signedUrls ?? []).map((s) => [s.path, s.signedUrl])
  );

  return (
    <div className="px-8 pb-16">
      {/* Hero */}
      <section className="rounded-2xl bg-[#EDE5D0] flex items-center gap-8 px-10 py-10 mb-10 min-h-[280px]">
        <div className="flex-1 max-w-xs">
          <h1 className="text-4xl font-bold tracking-tight mb-3">
            Your Library
          </h1>
          <p className="text-[#5a5a5a] text-sm leading-relaxed mb-6">
            Convert your books into interactive AI conversations. Listen, learn,
            and discuss your favorite reads.
          </p>
          <Link
            href="/new-book"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white rounded-xl text-sm font-medium border border-[#e0d8c8] hover:bg-[#f9f6f0] transition-colors"
          >
            <span>+</span>
            Add new book
          </Link>
        </div>

        <div className="flex-1 flex justify-center items-center select-none pointer-events-none">
          <span className="text-8xl">📚</span>
        </div>

        <div className="bg-white rounded-2xl p-6 min-w-[220px] self-start shadow-sm">
          <div className="flex flex-col gap-4">
            {howItWorks.map((step) => (
              <div key={step.number} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-[#F9F6F0] flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5">
                  {step.number}
                </div>
                <div>
                  <p className="text-sm font-semibold">{step.title}</p>
                  <p className="text-xs text-[#8a8a8a] mt-0.5">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Book grid */}
      {!books || books.length === 0 ? (
        <p className="text-center text-[#aaa] text-sm mt-16">
          No books yet.{" "}
          <Link href="/new-book" className="underline text-[#5C3D2E]">
            Add your first one.
          </Link>
        </p>
      ) : (
        <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-8">
          {books.map((book) => (
            <Link
              key={book.id}
              href={`/books/${book.id}`}
              prefetch={false}
              className="flex flex-col gap-2 group"
            >
              <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-[#E8E0CE] shadow-sm group-hover:shadow-md transition-shadow">
                {coverUrlMap[book.cover_path] ? (
                  <img
                    src={coverUrlMap[book.cover_path]}
                    alt={book.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl">
                    📖
                  </div>
                )}
              </div>
              <div>
                <h2 className="text-sm font-semibold leading-tight line-clamp-2">
                  {book.title}
                </h2>
                <p className="text-xs text-[#8a8a8a] mt-0.5">{book.author}</p>
              </div>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
