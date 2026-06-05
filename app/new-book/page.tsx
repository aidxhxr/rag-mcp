"use client";

import { useRef, useState } from "react";
import { maleVoices, femaleVoices, Voice } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export default async function NewBookPage() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("rachel");

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  async function handleFormSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const pdf = formData.get("bookPdf") as File | null;
    const cover = formData.get("bookCover") as File | null;
    const title = formData.get("bookTitle") as string;
    const author = formData.get("bookAuthor") as string;
    const voice = formData.get("bookAssistant") as string;
    if (!pdf || !cover) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.storage
      .from("book_pdf")
      .upload(`${user.id}/${Date.now()}.pdf`, pdf);
    await supabase.storage
      .from("book_cover")
      .upload(`${user.id}/${Date.now()}.pdf`, cover);
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      {/* Page heading */}
      <h1 className="text-xl font-semibold text-[#2a2a2a] mb-1">
        Upload a PDF to generate your interactive interview
      </h1>
      <p className="text-sm text-[#8a8a8a] mb-8">
        5 of 10 books used{" "}
        <span className="underline cursor-pointer hover:text-[#5a5a5a] transition-colors">
          (Upgrade)
        </span>
      </p>

      <form onSubmit={handleFormSubmit} className="flex flex-col gap-8">
        {/* PDF upload */}
        <div>
          <label className="block text-sm font-semibold text-[#2a2a2a] mb-2">
            Book PDF File
          </label>
          <input
            ref={pdfInputRef}
            type="file"
            accept=".pdf"
            name="bookPdf"
            className="hidden"
            onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => pdfInputRef.current?.click()}
            className="w-full bg-white rounded-2xl border border-[#e8e0d0] py-10 flex flex-col items-center gap-2 hover:bg-[#faf8f4] transition-colors cursor-pointer"
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#a89880"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span className="text-sm text-[#5a5a5a] font-medium">
              {pdfFile ? pdfFile.name : "Click to upload PDF"}
            </span>
            <span className="text-xs text-[#a0a0a0]">PDF file (max 50MB)</span>
          </button>
        </div>

        {/* Cover image upload */}
        <div>
          <label className="block text-sm font-semibold text-[#2a2a2a] mb-2">
            Cover Image{" "}
            <span className="font-normal text-[#8a8a8a]">(Optional)</span>
          </label>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            name="bookCover"
            className="hidden"
            onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => coverInputRef.current?.click()}
            className="w-full bg-white rounded-2xl border border-[#e8e0d0] py-10 flex flex-col items-center gap-2 hover:bg-[#faf8f4] transition-colors cursor-pointer"
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#a89880"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <span className="text-sm text-[#5a5a5a] font-medium">
              {coverFile ? coverFile.name : "Click to upload cover image"}
            </span>
            <span className="text-xs text-[#a0a0a0]">
              Leave empty to auto-generate from PDF
            </span>
          </button>
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-semibold text-[#2a2a2a] mb-2">
            Title
          </label>
          <input
            type="text"
            name="bookTitle"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ex: Rich Dad Poor Dad"
            className="w-full bg-white rounded-xl border border-[#e8e0d0] px-4 py-3 text-sm text-[#2a2a2a] placeholder:text-[#b0a898] outline-none focus:ring-2 focus:ring-[#c4a882] transition"
          />
        </div>

        {/* Author */}
        <div>
          <label className="block text-sm font-semibold text-[#2a2a2a] mb-2">
            Author Name
          </label>
          <input
            type="text"
            name="bookAuthor"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="ex: Robert Kiyosaki"
            className="w-full bg-white rounded-xl border border-[#e8e0d0] px-4 py-3 text-sm text-[#2a2a2a] placeholder:text-[#b0a898] outline-none focus:ring-2 focus:ring-[#c4a882] transition"
          />
        </div>

        {/* Voice selection */}
        <div>
          <p className="text-sm font-semibold text-[#2a2a2a] mb-4">
            Choose Assistant Voice
          </p>

          <p className="text-xs text-[#8a8a8a] mb-2">Male Voices</p>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {maleVoices.map((voice) => (
              <VoiceCard
                key={voice.id}
                voice={voice}
                selected={selectedVoice === voice.id}
                onSelect={() => setSelectedVoice(voice.id)}
              />
            ))}
          </div>

          <p className="text-xs text-[#8a8a8a] mb-2">Female Voices</p>
          <div className="grid grid-cols-3 gap-3">
            {femaleVoices.map((voice) => (
              <VoiceCard
                key={voice.id}
                voice={voice}
                selected={selectedVoice === voice.id}
                onSelect={() => setSelectedVoice(voice.id)}
              />
            ))}
          </div>
        </div>

        <input type="hidden" name="bookAssistant" value={selectedVoice} />

        {/* Submit */}
        <button
          type="submit"
          className="w-full bg-[#5C2D1A] hover:bg-[#4a2415] text-white font-semibold text-sm py-4 rounded-2xl transition-colors cursor-pointer"
        >
          Begin Synthesis
        </button>
      </form>
    </div>
  );
}

function VoiceCard({
  voice,
  selected,
  onSelect,
}: {
  voice: Voice;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left p-3 rounded-xl border transition-colors ${
        selected
          ? "border-[#5C2D1A] bg-white"
          : "border-[#e8e0d0] bg-white hover:bg-[#faf8f4]"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <div
          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
            selected ? "border-[#5C2D1A]" : "border-[#c0b8a8]"
          }`}
        >
          {selected && <div className="w-2 h-2 rounded-full bg-[#5C2D1A]" />}
        </div>
        <span className="text-sm font-semibold text-[#2a2a2a]">
          {voice.name}
        </span>
      </div>
      <p className="text-xs text-[#8a8a8a] leading-snug pl-6">
        {voice.description}
      </p>
    </button>
  );
}
