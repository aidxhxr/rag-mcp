import Image from "next/image";
import Link from "next/link";
import { bookSamples, howItWorks } from "@/lib/constants";

export default function Home() {
  return (
    <div className="px-8 pb-16">
      {/* Hero */}
      <section className="rounded-2xl bg-[#EDE5D0] flex items-center gap-8 px-10 py-10 mb-10 min-h-[280px]">
        {/* Left: title + CTA */}
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

        {/* Center: illustration */}
        <div className="flex-1 flex justify-center items-center select-none pointer-events-none">
          <span className="text-8xl">📚</span>
        </div>

        {/* Right: steps card */}
        <div className="bg-white rounded-2xl p-6 min-w-[220px] self-start shadow-sm">
          <div className="flex flex-col gap-4">
            {howItWorks.map((step) => (
              <div key={step.number} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-[#F9F6F0] flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5">
                  {step.number}
                </div>
                <div>
                  <p className="text-sm font-semibold">{step.title}</p>
                  <p className="text-xs text-[#8a8a8a] mt-0.5">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Book grid */}
      <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-8">
        {bookSamples.map((book) => (
          <article
            key={book.id}
            className="flex flex-col gap-2 cursor-pointer group"
          >
            <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-[#E8E0CE] shadow-sm group-hover:shadow-md transition-shadow">
              <Image
                src={book.imageUrl}
                alt={book.name}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
                className="object-cover"
              />
            </div>
            <div>
              <h2 className="text-sm font-semibold leading-tight line-clamp-2">
                {book.name}
              </h2>
              <p className="text-xs text-[#8a8a8a] mt-0.5">{book.author}</p>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
