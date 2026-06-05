import { DeepgramClient } from "@deepgram/sdk";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const blob = await req.blob();
  if (!blob.size) {
    return NextResponse.json({ error: "No audio data" }, { status: 400 });
  }

  const client = new DeepgramClient({
    apiKey: process.env.DEEPGRAM_API_KEY!,
  });

  let response;
  try {
    response = await client.listen.v1.media.transcribeFile(blob, {
      model: "nova-2",
      smart_format: true,
      punctuate: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transcription failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (!("results" in response)) {
    return NextResponse.json({ error: "Unexpected async response" }, { status: 500 });
  }

  const transcript =
    response.results.channels[0]?.alternatives?.[0]?.transcript ?? "";

  return NextResponse.json({ transcript });
}
