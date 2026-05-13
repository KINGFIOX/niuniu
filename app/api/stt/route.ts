import { recognizeShortAudio } from "@/lib/volcSpeech";

export const runtime = "edge";

const MAX_AUDIO_BYTES = 2 * 1024 * 1024; // 2MB ≈ 60s @ 16kHz mono 16-bit

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";
  let wav: ArrayBuffer | null = null;

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("audio");
      if (file instanceof Blob) {
        wav = await file.arrayBuffer();
      }
    } else {
      // Fallback: raw body of audio/wav.
      wav = await req.arrayBuffer();
    }
  } catch {
    return jsonError("Failed to read audio body", 400);
  }

  if (!wav || wav.byteLength === 0) {
    return jsonError("audio is empty", 400);
  }
  if (wav.byteLength > MAX_AUDIO_BYTES) {
    return jsonError(`audio too large (${wav.byteLength} bytes)`, 400);
  }

  try {
    const { text } = await recognizeShortAudio(wav);
    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "STT failed";
    return jsonError(msg, 502);
  }
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
