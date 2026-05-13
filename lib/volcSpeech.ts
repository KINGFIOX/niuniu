// Server-side helpers for Volcengine OpenSpeech.
//
// TTS:  豆包语音合成模型 2.0 (Seed-TTS, v3 unidirectional)
//       POST https://openspeech.bytedance.com/api/v3/tts/unidirectional
//       Auth headers:
//         X-Api-App-Id / X-Api-Access-Key / X-Api-Resource-Id
//       Resource id is auto-derived from voice type:
//         S_*                 → seed-icl-2.0       (声音复刻 2.0)
//         *_uranus_* | saturn_* → seed-tts-2.0     (官方 2.0 音色)
//         *_moon_* | *_mars_* | ICL_*  → seed-tts-1.0   (官方 1.0 音色)
//       Response is NDJSON — each line is a JSON object containing a base64
//       audio chunk; we concatenate them into one mp3 blob.
//       Service must be enabled: 火山控制台 → 豆包语音 →「豆包语音合成模型2.0 字符版」
//
// STT:  豆包录音文件识别模型 2.0 (v3 big-model)
//       POST https://openspeech.bytedance.com/api/v3/auc/bigmodel/submit
//       POST https://openspeech.bytedance.com/api/v3/auc/bigmodel/query
//       Auth: X-Api-App-Key / X-Api-Access-Key / X-Api-Resource-Id / X-Api-Request-Id
//       Service must be enabled: 火山控制台 → 豆包语音 →「豆包录音文件识别模型2.0 标准版」
//
// References:
//   https://www.volcengine.com/docs/6561/1829010  (TTS v3 异步长文本)
//   https://blog.ax0x.ai/doubao-tts-runbook-zh    (TTS v3 unidirectional walkthrough)
//   https://blog.ax0x.ai/doubao-stt-runbook       (STT v3 walkthrough)

const VOLC_TTS_ENDPOINT =
  "https://openspeech.bytedance.com/api/v3/tts/unidirectional";
const VOLC_ASR_SUBMIT = "https://openspeech.bytedance.com/api/v3/auc/bigmodel/submit";
const VOLC_ASR_QUERY = "https://openspeech.bytedance.com/api/v3/auc/bigmodel/query";
// Default resource id for 豆包录音文件识别模型2.0 标准版 / Seed-ASR bigmodel.
// If the API returns "resource not granted" (HTTP 403, code 45000030), try
// `volc.bigasr.auc` (older "大模型" naming) via the VOLC_ASR_RESOURCE_ID env var.
const VOLC_ASR_RESOURCE_ID = "volc.seedasr.auc";

// Default voice = a Seed-TTS 2.0 official voice (uranus family). The 字符版
// trial pack of 豆包语音合成模型2.0 includes the official 2.0 voices, so this
// works out of the box once the service is enabled.
const DEFAULT_TTS_VOICE = "zh_female_vv_uranus_bigtts";

function readEnv() {
  const appId = process.env.VOLC_APP_ID;
  const token = process.env.VOLC_ACCESS_TOKEN;
  if (!appId || !token) {
    throw new Error(
      "Volcengine speech not configured. Set VOLC_APP_ID + VOLC_ACCESS_TOKEN in .env.local",
    );
  }
  const ttsVoice = process.env.VOLC_TTS_VOICE_TYPE || DEFAULT_TTS_VOICE;
  return {
    appId,
    token,
    ttsVoice,
    // X-Api-Resource-Id can be force-overridden via env if a user prefers a
    // specific service (e.g. seed-tts-1.0-concurr for high-concurrency 1.0).
    ttsResourceId:
      process.env.VOLC_TTS_RESOURCE_ID || resourceIdForVoice(ttsVoice),
    asrResourceId: process.env.VOLC_ASR_RESOURCE_ID || VOLC_ASR_RESOURCE_ID,
  };
}

// Map speaker / voice name to the Seed-TTS service resource id. The gateway
// rejects with `55000000: resource ID is mismatched` if the header doesn't
// align with the voice family.
function resourceIdForVoice(voice: string): string {
  if (voice.startsWith("S_")) return "seed-icl-2.0";
  if (voice.startsWith("saturn_") || voice.includes("_uranus_")) {
    return "seed-tts-2.0";
  }
  return "seed-tts-1.0";
}

function newReqId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// TTS · 语音合成 (Seed-TTS v3 unidirectional)
// ---------------------------------------------------------------------------
export type TtsResult = {
  audio: Uint8Array;
  mime: "audio/mp3";
};

export async function synthesizeSpeech(
  text: string,
  opts: { speed?: number } = {},
): Promise<TtsResult> {
  const { appId, token, ttsVoice, ttsResourceId } = readEnv();
  const r = await fetch(VOLC_TTS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-App-Id": appId,
      "X-Api-Access-Key": token,
      "X-Api-Resource-Id": ttsResourceId,
      "X-Api-Request-Id": newReqId(),
    },
    body: JSON.stringify({
      user: { uid: "niuniu-zoo-chat" },
      req_params: {
        text,
        speaker: ttsVoice,
        audio_params: {
          format: "mp3",
          sample_rate: 24000,
          // 1.0 baseline; UI exposes [0.5, 2.0]
          speech_rate: opts.speed ?? 1.0,
        },
      },
    }),
  });

  const bodyText = await r.text();
  if (!r.ok) {
    throw new Error(`Volc TTS HTTP ${r.status}: ${bodyText.slice(0, 400)}`);
  }

  // NDJSON: one JSON object per line. `data` is a base64 mp3 chunk; the
  // final terminal line carries code === 20000000.
  const chunks: Uint8Array[] = [];
  let streamError: string | null = null;
  for (const line of bodyText.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let parsed: { code?: number; data?: string; message?: string };
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (parsed.code === 0 && parsed.data) {
      chunks.push(base64ToUint8Array(parsed.data));
      continue;
    }
    if (parsed.code === 20000000) break;
    if (parsed.code !== undefined && parsed.code !== 0) {
      streamError = `code=${parsed.code} message=${parsed.message ?? "unknown"}`;
      break;
    }
  }

  if (streamError) {
    throw new Error(`Volc TTS stream error: ${streamError}`);
  }
  if (chunks.length === 0) {
    throw new Error(
      `Volc TTS returned no audio data. Body: ${bodyText.slice(0, 300)}`,
    );
  }

  return { audio: concatBytes(chunks), mime: "audio/mp3" };
}

// ---------------------------------------------------------------------------
// ASR · 豆包录音文件识别模型 2.0 (v3 big-model)
// ---------------------------------------------------------------------------
// Flow:
//   1. POST submit with audio base64; X-Api-Request-Id IS the task id.
//   2. Poll query (same X-Api-Request-Id) until response body !== "{}".
//   3. Extract result.text.
// Short PTT clips (3~10s) usually return on the 1st or 2nd poll (~2s total).

type AsrQueryJson = {
  audio_info?: { duration?: number };
  result?: {
    text?: string;
    utterances?: { text: string }[];
  };
};

function asrHeaders(reqId: string) {
  const { appId, token, asrResourceId } = readEnv();
  return {
    "Content-Type": "application/json",
    "X-Api-App-Key": appId,
    "X-Api-Access-Key": token,
    "X-Api-Resource-Id": asrResourceId,
    "X-Api-Request-Id": reqId,
  } as Record<string, string>;
}

async function asrSubmit(audioBase64: string, format: string): Promise<string> {
  const reqId = newReqId();
  const r = await fetch(VOLC_ASR_SUBMIT, {
    method: "POST",
    headers: asrHeaders(reqId),
    body: JSON.stringify({
      user: { uid: "niuniu-zoo-chat" },
      audio: { data: audioBase64, format },
    }),
  });
  const bodyText = await r.text();
  if (!r.ok) {
    throw new Error(`Volc ASR submit HTTP ${r.status}: ${bodyText.slice(0, 300)}`);
  }
  // Successful submit returns 200 with body "{}"; the reqId we sent IS the
  // task identifier we use to poll.
  return reqId;
}

async function asrQuery(reqId: string): Promise<AsrQueryJson | null> {
  const r = await fetch(VOLC_ASR_QUERY, {
    method: "POST",
    headers: asrHeaders(reqId),
    body: "{}",
  });
  const bodyText = await r.text();
  if (!r.ok) {
    throw new Error(`Volc ASR query HTTP ${r.status}: ${bodyText.slice(0, 300)}`);
  }
  const trimmed = bodyText.trim();
  if (!trimmed || trimmed === "{}") return null;
  try {
    return JSON.parse(trimmed) as AsrQueryJson;
  } catch {
    throw new Error(`Volc ASR query non-JSON: ${bodyText.slice(0, 300)}`);
  }
}

export async function recognizeShortAudio(
  wav: ArrayBuffer,
): Promise<{ text: string }> {
  const audioBase64 = arrayBufferToBase64(wav);
  const reqId = await asrSubmit(audioBase64, "wav");

  const POLL_INTERVAL_MS = 600;
  const MAX_POLLS = 25; // ~15s total
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    const result = await asrQuery(reqId);
    if (!result) continue;
    const text =
      result.result?.text ??
      result.result?.utterances?.map((u) => u.text).join("") ??
      "";
    return { text: text.trim() };
  }
  throw new Error(
    `Volc ASR timeout after ${(MAX_POLLS * POLL_INTERVAL_MS) / 1000}s`,
  );
}

// ---------------------------------------------------------------------------
// utilities
// ---------------------------------------------------------------------------
function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.byteLength;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.byteLength;
  }
  return out;
}
