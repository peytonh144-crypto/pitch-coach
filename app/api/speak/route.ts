import OpenAI from "openai";

let _openai: OpenAI | null = null;
function openai(): OpenAI {
  if (!_openai) _openai = new OpenAI();
  return _openai;
}

const ALLOWED_VOICES = new Set([
  "alloy",
  "echo",
  "fable",
  "onyx",
  "nova",
  "shimmer",
]);

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    text?: string;
    voice?: string;
  } | null;

  if (!body || typeof body.text !== "string" || !body.text.trim()) {
    return Response.json(
      { error: "Missing 'text' string in request body." },
      { status: 400 },
    );
  }

  const voice =
    body.voice && ALLOWED_VOICES.has(body.voice) ? body.voice : "onyx";

  try {
    const speech = await openai().audio.speech.create({
      model: "tts-1",
      voice: voice as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer",
      input: body.text,
    });
    const buffer = Buffer.from(await speech.arrayBuffer());
    return new Response(buffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
