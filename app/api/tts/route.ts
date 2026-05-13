import { synthesizeSpeech } from "@/lib/volcSpeech";

export const runtime = "edge";

const MAX_TEXT = 500;

export async function POST(req: Request) {
  let body: { text?: string; speed?: number };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const text = (body.text ?? "").toString().trim();
  if (!text) return jsonError("text is empty", 400);
  if (text.length > MAX_TEXT) {
    return jsonError(`text too long (${text.length} > ${MAX_TEXT})`, 400);
  }

  try {
    const { audio, mime } = await synthesizeSpeech(text, {
      speed: typeof body.speed === "number" ? body.speed : undefined,
    });
    return new Response(audio, {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Content-Length": audio.byteLength.toString(),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "TTS failed";
    return jsonError(msg, 502);
  }
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
