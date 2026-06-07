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

const SPEECH_THRESHOLD = 5;    // RMS × 100 that counts as speech (raise if too sensitive)
const SPEECH_MIN_MS = 600;     // must speak for at least this long before committing
const SILENCE_MS = 2000;       // ms of quiet after speech before committing
const VAD_START_DELAY = 400;   // ms to wait after recorder starts before VAD polls (mic settle)

export default function ChatUI({ book }: { book: Book }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [interimText, setInterimText] = useState("");
  const coverUrl = book.coverUrl?.startsWith("http") ? book.coverUrl : null;

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const vadRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRecordingRef = useRef(false);

  useEffect(() => {
    return () => {
      isRecordingRef.current = false;
      if (vadRef.current) clearInterval(vadRef.current);
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
      setIsThinking(false);
      if (answer) {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "book", text: answer },
        ]);
        setInterimText("Speaking…");
        try {
          const speakRes = await fetch("/api/speak", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: answer, voice_id: book.voiceId }),
          });
          if (speakRes.ok) {
            const audioBlob = await speakRes.blob();
            const url = URL.createObjectURL(audioBlob);
            const audio = new Audio(url);
            await new Promise<void>((resolve) => {
              audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
              audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
              audio.play().catch(() => resolve());
            });
          } else {
            console.error("[speak] error:", await speakRes.text());
          }
        } catch (err) {
          console.error("[speak]", err);
        }
        setInterimText("");
      }
    } catch (err) {
      console.error("[chat]", err);
      setIsThinking(false);
    }
  };

  // Records one utterance (until silence) then transcribes + sends, then restarts.
  const startSession = (stream: MediaStream) => {
    if (!isRecordingRef.current) return;

    setInterimText("Listening…");

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(stream, { mimeType });
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = async () => {
      // If the user clicked stop, just clear any lingering status and exit
      if (!isRecordingRef.current) {
        setInterimText("");
        return;
      }

      const blob = new Blob(chunks, { type: mimeType });
      console.log("[transcribe] blob size:", blob.size, "bytes, type:", mimeType);
      if (blob.size > 1500) {
        setInterimText("Transcribing…");
        try {
          const res = await fetch("/api/transcribe", { method: "POST", body: blob });
          if (res.ok) {
            const { transcript } = (await res.json()) as { transcript: string };
            const text = transcript?.trim() ?? "";
            if (text) {
              setInterimText("");
              await sendQuery(text);
            }
          }
        } catch (err) {
          console.error("[transcribe]", err);
        }
      }
      // Restart for next utterance
      startSession(stream);
    };

    recorder.start();

    // --- AudioContext VAD ---
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);
    let hasSpeech = false;
    let speechStart: number | null = null;
    let silenceStart: number | null = null;

    if (vadRef.current) clearInterval(vadRef.current);

    // Delay VAD polling so mic transient noise at startup doesn't trigger speech
    const startVad = async () => {
      console.log("[vad] audioCtx state:", audioCtx.state);
      await audioCtx.resume();
      vadRef.current = setInterval(() => {
        if (!isRecordingRef.current) {
          clearInterval(vadRef.current!);
          vadRef.current = null;
          audioCtx.close().catch(() => {});
          return;
        }

        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const x = (data[i] - 128) / 128;
          sum += x * x;
        }
        const rms = Math.sqrt(sum / data.length) * 100;
        console.log("[vad] rms:", rms.toFixed(1));

        if (rms > SPEECH_THRESHOLD) {
          if (!speechStart) speechStart = Date.now();
          // Only count as real speech after sustained signal
          if (!hasSpeech && Date.now() - speechStart >= SPEECH_MIN_MS) {
            hasSpeech = true;
          }
          silenceStart = null;
          if (hasSpeech) setInterimText("Speaking…");
        } else {
          if (hasSpeech) {
            if (silenceStart === null) silenceStart = Date.now();
            else if (Date.now() - silenceStart >= SILENCE_MS) {
              clearInterval(vadRef.current!);
              vadRef.current = null;
              audioCtx.close().catch(() => {});
              if (recorder.state !== "inactive") recorder.stop();
            }
          }
        }
      }, 100);
    };

    setTimeout(startVad, VAD_START_DELAY);
  };

  const startRecording = async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      streamRef.current = stream;
    } catch (err) {
      console.error("[mic] getUserMedia failed:", err);
      return;
    }
    isRecordingRef.current = true;
    setIsRecording(true);
    startSession(stream);
  };

  const stopRecording = () => {
    isRecordingRef.current = false;
    if (vadRef.current) { clearInterval(vadRef.current); vadRef.current = null; }
    if (recorderRef.current?.state !== "inactive") recorderRef.current?.stop();
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setIsRecording(false);
    setInterimText("");
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
            <img src={coverUrl} alt={book.title} className="w-24 h-32 object-cover rounded-xl shadow-md" />
          ) : (
            <div className="w-24 h-32 rounded-xl bg-[#D5CAAB] flex items-center justify-center text-3xl shadow-md">📖</div>
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
        {messages.length === 0 && !interimText && !isThinking ? (
          <p className="text-center text-[#aaa] text-sm m-auto">Press the mic and start talking</p>
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

            {/* Status bubble — Listening… / Speaking… / Transcribing… */}
            {(interimText || (isRecording && !isThinking)) && (
              <div className="self-end max-w-[75%] rounded-2xl px-5 py-3 text-base leading-relaxed bg-[#F5DEB3] text-[#1a1a1a]/50 italic">
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
