import Image from "next/image";
import Link from "next/link";

const steps = [
  { n: 1, title: "Upload PDF", desc: "Add your book file" },
  { n: 2, title: "AI Processing", desc: "We analyze the content" },
  { n: 3, title: "Voice Chat", desc: "Discuss with AI" },
];

const HeroSection = () => {
  return (
    <section className="wrapper pt-28 mb-10">
      <div className="library-hero-card">
        <div className="library-hero-content">
          {/* Left Part */}
          <div className="library-hero-text">
            <h1 className="library-hero-title font-serif font-semibold">
              Your Library
            </h1>
            <p className="library-hero-description">
              Convert your books into interactive AI conversations. Listen,
              learn, and discuss your favorite reads.
            </p>
            <Link
              href="/books/new"
              className="library-cta-primary mt-4 flex items-center justify-center"
            >
              <span className="text-3xl font-light mb-1 mr-2">+</span>
              <span className="text-[#212a3b]">Add new book</span>
            </Link>
          </div>

          {/* Center illustration — hidden on mobile */}
          <div className="library-hero-illustration-desktop">
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
          <div className="library-steps-card flex flex-col gap-4">
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
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
