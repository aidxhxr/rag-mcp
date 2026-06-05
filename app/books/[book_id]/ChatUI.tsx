"use client";

import { Mic } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { DeepgramClient } from "@deepgram/sdk";

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
  const [isConnecting, setIsConnecting] = useState(false);
  const [interimText, setInterimText] = useState("");
  const coverUrl = book.coverUrl?.startsWith("http") ? book.coverUrl : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dgRef = useRef<any>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const finalRef = useRef("");

  useEffect(() => {
    return () => {
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      dgRef.current?.close();
    };
  }, []);

  const startRecording = async () => {
    const apiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY!;
    setIsConnecting(true);

    try {
      console.log("[mic] got stream, apiKey present:", !!apiKey);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Raw WebSocket test — bypasses the SDK to isolate auth/network issues
      const testWs = new WebSocket(
        `wss://api.deepgram.com/v1/listen?model=nova-3&token=${apiKey}`
      );
      testWs.onopen = () => console.log("[RAW WS] open ✓");
      testWs.onerror = (e) => console.log("[RAW WS] error", e);
      testWs.onclose = (e) => console.log("[RAW WS] close", e.code, e.reason);

      const client = new DeepgramClient({ apiKey });
      const socket = await client.listen.v1.connect({
        model: "nova-3",
        Authorization: `Token ${apiKey}`,
        queryParams: { token: apiKey },
        interim_results: "true",
        smart_format: "true",
        punctuate: "true",
        utterance_end_ms: 1000,
        vad_events: "true",
      });

      dgRef.current = socket;
      console.log("[DG] socket created, readyState:", socket.readyState);

      socket.on("open", () => {
        console.log("[DG] socket open");
        setIsConnecting(false);
        setIsRecording(true);
      });

      socket.on("message", (msg) => {
        console.log("[DG] message:", msg.type, msg);
        if (msg.type !== "Results") return;
        const text = msg.channel.alternatives[0]?.transcript ?? "";
        console.log("[DG] transcript:", JSON.stringify(text), "is_final:", msg.is_final);
        if (!text) return;
        if (msg.is_final) {
          finalRef.current = finalRef.current
            ? `${finalRef.current} ${text}`
            : text;
          setInterimText("");
        } else {
          setInterimText(text);
        }
      });

      socket.on("close", (e) => console.log("[DG] socket closed", e));
      socket.on("error", (err) => console.error("[DG] error", err));

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      console.log("[mic] mimeType:", mimeType);
      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => {
        console.log("[mic] chunk size:", e.data.size, "readyState:", dgRef.current?.readyState);
        if (e.data.size > 0 && dgRef.current?.readyState === 1) {
          dgRef.current.sendMedia(e.data);
        }
      };
      recorder.start(250);
      recorderRef.current = recorder;
      console.log("[mic] recorder started");
    } catch (err) {
      console.error("[mic]", err);
      setIsConnecting(false);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      dgRef.current?.close();
      dgRef.current = null;
    }
  };

  const stopRecording = () => {
    setIsRecording(false);

    recorderRef.current?.stop();
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    dgRef.current?.sendFinalize({ type: "Finalize" });
    setTimeout(() => {
      dgRef.current?.close();
      dgRef.current = null;

      const transcript = finalRef.current.trim();
      finalRef.current = "";
      setInterimText("");

      if (transcript) {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "user" as const, text: transcript },
        ]);
        // TODO: POST to /api/chat
      }
    }, 600);
  };

  const toggleRecording = () => {
    if (isConnecting) return;
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

      {/* Chat messages — scrolls internally */}
      <div className="flex-1 min-h-0 bg-white rounded-2xl p-6 flex flex-col gap-4 overflow-y-auto">
        {messages.length === 0 && !interimText ? (
          <p className="text-center text-[#aaa] text-sm m-auto">
            Press the mic and start talking
          </p>
        ) : (
          <>
            {messages.map((msg) => (
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
            ))}
            {interimText && (
              <div className="self-end max-w-[75%] rounded-2xl px-5 py-4 text-sm leading-relaxed bg-[#5C3D2E]/40 text-white italic">
                {interimText}
              </div>
            )}
          </>
        )}
      </div>

      {/* Mic button — pinned at bottom center */}
      <div className="flex justify-center shrink-0">
        <button
          onClick={toggleRecording}
          disabled={isConnecting}
          className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            isRecording
              ? "bg-[#5C3D2E] ring-4 ring-[#5C3D2E]/30 scale-110"
              : isConnecting
              ? "bg-[#5C3D2E]/60 animate-pulse"
              : "bg-[#5C3D2E] hover:scale-105"
          }`}
        >
          <Mic className="w-7 h-7 text-white" />
        </button>
      </div>
    </div>
  );
}
