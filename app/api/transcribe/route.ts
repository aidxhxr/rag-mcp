import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "audio/webm";
  const blob = await req.blob();
  console.log("[transcribe] received blob size:", blob.size, "type:", contentType);

  if (!blob.size) {
    return NextResponse.json({ error: "No audio data" }, { status: 400 });
  }

  const params = new URLSearchParams({
    model: "nova-2",
    smart_format: "true",
    punctuate: "true",
  });

  const dgRes = await fetch(
    `https://api.deepgram.com/v1/listen?${params}`,
    {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        "Content-Type": contentType,
      },
      body: blob,
    }
  );

  if (!dgRes.ok) {
    const errText = await dgRes.text();
    console.error("[transcribe] Deepgram error:", dgRes.status, errText);
    return NextResponse.json(
      { error: `Deepgram ${dgRes.status}: ${errText}` },
      { status: 500 }
    );
  }

  const data = (await dgRes.json()) as {
    results?: { channels?: { alternatives?: { transcript: string }[] }[] };
  };
  console.log("[transcribe] Deepgram raw response:", JSON.stringify(data));
  const transcript =
    data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
  console.log("[transcribe] transcript:", JSON.stringify(transcript));

  return NextResponse.json({ transcript });
}
