import Image from "next/image";
import Link from "next/link";
import { Plus } from "lucide-react";

const steps = [
  { n: 1, title: "Upload PDF", desc: "Add your book file" },
  { n: 2, title: "AI Processing", desc: "We analyze the content" },
  { n: 3, title: "Voice Chat", desc: "Discuss with AI" },
];

const HeroSection = () => {
  return (
    <section className="bg-[#f3e4c7] rounded-[14px] p-5 lg:px-10 lg:py-6 flex flex-col lg:flex-row items-center justify-between gap-6 w-full">
      {/* Left */}
      <div className="flex flex-col gap-4 w-full lg:max-w-[340px] items-center lg:items-start text-center lg:text-left">
        <h1 className="library-hero-title">Your Library</h1>
        <p className="library-hero-description">
          Convert your books into interactive AI conversations. Listen, learn,
          and discuss your favorite reads.
        </p>
        <Link href="/books/new" className="library-cta-primary w-fit">
          <Plus className="w-5 h-5" />
          Add new book
        </Link>
      </div>

      {/* Center illustration — hidden on mobile */}
      <div className="hidden lg:flex items-center justify-center flex-1">
        <Image
          src="/assets/hero-illustration.png"
          alt="Vintage books and globe"
          width={340}
          height={280}
          className="object-contain"
          priority
        />
      </div>

      {/* Right — steps card */}
      <div className="bg-white rounded-[10px] p-4 flex flex-col gap-4 w-full lg:min-w-[220px] lg:w-auto">
        {steps.map(({ n, title, desc }) => (
          <div key={n} className="library-step-item">
            <span className="library-step-number">{n}</span>
            <div>
              <p className="library-step-title">{title}</p>
              <p className="library-step-description">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default HeroSection;
