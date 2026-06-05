import { NextRequest, NextResponse } from "next/server";

// Maps app voice IDs → Deepgram Aura-2 model names
const VOICE_MAP: Record<string, string> = {
  rachel: "aura-2-asteria-en",
  sarah: "aura-2-luna-en",
  dave: "aura-2-orpheus-en",
  daniel: "aura-2-orion-en",
  chris: "aura-2-arcas-en",
};

export async function POST(req: NextRequest) {
  const { text, voice_id } = await req.json();
  if (!text) return NextResponse.json({ error: "Missing text" }, { status: 400 });

  const model = VOICE_MAP[voice_id] ?? "aura-2-asteria-en";
  const apiKey = process.env.DEEPGRAM_API_KEY!;

  const dgRes = await fetch(
    `https://api.deepgram.com/v1/speak?model=${model}&encoding=mp3`,
    {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    }
  );

  if (!dgRes.ok) {
    const err = await dgRes.text();
    return NextResponse.json({ error: err }, { status: dgRes.status });
  }

  return new NextResponse(dgRes.body, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Transfer-Encoding": "chunked",
    },
  });
}
