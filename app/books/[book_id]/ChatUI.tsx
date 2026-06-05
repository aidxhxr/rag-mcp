"use client";

import { Mic } from "lucide-react";
import { useState, useRef, useEffect } from "react";

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [interimText, setInterimText] = useState("");
  const coverUrl = book.coverUrl?.startsWith("http") ? book.coverUrl : null;

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isRecordingRef = useRef(false);
  const finalRef = useRef("");
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(0);

  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const sendQuery = async (query: string) => {
    if (!query.trim()) return;

    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", text: query.trim() },
    ]);
    setIsThinking(true);

    try {
      const chatRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ book_id: book.id, query: query.trim() }),
      });
      if (!chatRes.ok) throw new Error(await chatRes.text());
      const { answer } = (await chatRes.json()) as { answer: string };

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "book", text: answer },
      ]);
      setIsThinking(false);

      void (async () => {
        const speakRes = await fetch("/api/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: answer, voice_id: book.voiceId }),
        });
        if (!speakRes.ok) return;
        const audioBlob = await speakRes.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.play().catch(console.error);
        audio.onended = () => URL.revokeObjectURL(audioUrl);
      })();
    } catch (err) {
      console.error("[chat]", err);
      setIsThinking(false);
    }
  };

  const transcribeChunk = async (blob: Blob) => {
    if (blob.size < 500) return;
    inFlightRef.current++;
    try {
      const res = await fetch("/api/transcribe", { method: "POST", body: blob });
      if (!res.ok) return;

      const { transcript } = (await res.json()) as { transcript: string };
      const trimmed = transcript.trim();

      if (trimmed) {
        // Speech detected — accumulate and cancel any pending silence commit
        finalRef.current = finalRef.current
          ? `${finalRef.current} ${trimmed}`
          : trimmed;
        setInterimText(finalRef.current);
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      } else if (finalRef.current.trim() && isRecordingRef.current) {
        // Silent chunk AND we have accumulated text — start commit timer (if not already running)
        if (!silenceTimerRef.current) {
          silenceTimerRef.current = setTimeout(() => {
            silenceTimerRef.current = null;
            const query = finalRef.current.trim();
            finalRef.current = "";
            setInterimText("");
            if (query) void sendQuery(query);
          }, 1000);
        }
      }
    } catch (err) {
      console.error("[transcribe]", err);
    } finally {
      inFlightRef.current--;
    }
  };

  const startRecording = async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
    } catch (err) {
      console.error("[mic] getUserMedia failed:", err);
      return;
    }

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    const recorder = new MediaRecorder(stream, { mimeType });
    recorderRef.current = recorder;
    isRecordingRef.current = true;
    setIsRecording(true);

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        void transcribeChunk(new Blob([e.data], { type: mimeType }));
      }
    };

    recorder.start(3000); // send a chunk every 3 seconds
    console.log("[mic] recording started, mimeType:", mimeType);
  };

  const stopRecording = () => {
    isRecordingRef.current = false;

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = () => {
        // Wait for any in-flight transcription requests to finish
        const waitAndCommit = () => {
          if (inFlightRef.current > 0) {
            setTimeout(waitAndCommit, 200);
            return;
          }
          const transcript = finalRef.current.trim();
          finalRef.current = "";
          setInterimText("");
          if (transcript) void sendQuery(transcript);
        };
        setTimeout(waitAndCommit, 200);
      };
      recorder.stop();
    }

    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setIsRecording(false);
  };

  const toggleRecording = () => {
    if (isRecording) stopRecording();
    else void startRecording();
  };

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

      {/* Chat messages */}
      <div className="flex-1 min-h-0 bg-white rounded-2xl p-6 flex flex-col gap-3 overflow-y-auto">
        {messages.length === 0 && !interimText && !isThinking && !isRecording ? (
          <p className="text-center text-[#aaa] text-sm m-auto">
            Press the mic and start talking
          </p>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`max-w-[75%] rounded-2xl px-5 py-3 text-base leading-relaxed ${
                  msg.role === "book"
                    ? "self-start bg-[#EDE5D0] text-[#1a1a1a]"
                    : "self-end bg-[#F5DEB3] text-[#1a1a1a]"
                }`}
              >
                {msg.text}
              </div>
            ))}

            {/* Live interim bubble — shows transcription as it comes in */}
            {(isRecording || interimText) && (
              <div className="self-end max-w-[75%] rounded-2xl px-5 py-3 text-base leading-relaxed bg-[#F5DEB3] text-[#1a1a1a]/60 italic">
                {interimText || "Listening…"}
              </div>
            )}

            {isThinking && (
              <div className="self-start max-w-[75%] rounded-2xl px-5 py-3 text-base leading-relaxed bg-[#EDE5D0] text-[#1a1a1a]/40 italic">
                Thinking…
              </div>
            )}
          </>
        )}
      </div>

      {/* Mic button */}
      <div className="flex justify-center shrink-0">
        <button
          onClick={toggleRecording}
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
