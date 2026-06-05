"use client";

import { Mic } from "lucide-react";
import { useState } from "react";

type Book = {
  id: string;
  title: string;
  author: string;
  voiceId: string;
  coverUrl: string | null;
};

type Message = {
  id: string;
  role: "book" | "user";
  text: string;
};

export default function ChatUI({ book }: { book: Book }) {
  const [messages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const coverUrl = book.coverUrl?.startsWith("http") ? book.coverUrl : null;

  return (
    <div className="h-[calc(100dvh-60px)] flex flex-col px-8 py-6 gap-4 overflow-hidden">
      {/* Book header */}
      <div className="bg-[#EDE5D0] rounded-2xl p-6 flex items-center gap-6 shrink-0">
        <div className="shrink-0">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={book.title}
              className="w-24 h-32 object-cover rounded-xl shadow-md"
            />
          ) : (
            <div className="w-24 h-32 rounded-xl bg-[#D5CAAB] flex items-center justify-center text-3xl shadow-md">
              📖
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <h1 className="text-2xl font-bold">{book.title}</h1>
            <p className="text-[#6b6b6b] text-sm">by {book.author}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full text-xs font-medium border border-[#e0d8c8]">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Ready
            </span>
            <span className="px-3 py-1.5 bg-white rounded-full text-xs font-medium border border-[#e0d8c8]">
              Voice: {book.voiceId}
            </span>
          </div>
        </div>
      </div>

      {/* Chat messages — scrolls internally */}
      <div className="flex-1 min-h-0 bg-white rounded-2xl p-6 flex flex-col gap-4 overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-center text-[#aaa] text-sm m-auto">
            Press the mic and start talking
          </p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`max-w-[75%] rounded-2xl px-5 py-4 text-sm leading-relaxed ${
                msg.role === "book"
                  ? "self-start bg-[#EDE5D0] text-[#1a1a1a]"
                  : "self-end bg-[#5C3D2E] text-white"
              }`}
            >
              {msg.text}
            </div>
          ))
        )}
      </div>

      {/* Mic button — pinned at bottom center */}
      <div className="flex justify-center shrink-0">
        <button
          onClick={() => setIsRecording((r) => !r)}
          className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all ${
            isRecording
              ? "bg-[#5C3D2E] ring-4 ring-[#5C3D2E]/30 scale-110"
              : "bg-[#5C3D2E] hover:scale-105"
          }`}
        >
          <Mic className="w-7 h-7 text-white" />
        </button>
      </div>
    </div>
  );
}
