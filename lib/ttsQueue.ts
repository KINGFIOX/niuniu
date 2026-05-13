// Client-side TTS playback queue. Each call to enqueue() fetches an mp3 from
// /api/tts and plays it in submission order, regardless of the order the
// network responses come back.
//
// The queue is global (per tab) so two messages cannot race; calling clear()
// from anywhere stops audio immediately and drops pending items.

type QueueItem = {
  // generation counter at enqueue time; bumped by clear() so stale items
  // resolved by an in-flight fetch are dropped on arrival.
  generation: number;
  text: string;
  // pre-resolved on success / null on failure
  audioPromise: Promise<Blob | null>;
};

// Tiny base64-encoded silent mp3 (~0.05s). Played once on the first user
// gesture to unlock subsequent auto-play on iOS Safari.
const SILENT_MP3 = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjEyLjEwMAAAAAAAAAAAAAAA//tQwAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgP////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjE5AAAAAAAAAAAAAAAAJAAAAAAAAAAAAnHHGmO8AAAAAAAAAAAAAAAAAAAAA//sQZAAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sQZB4P8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sQZDwP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sQZFoP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sQZHgP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sQZJYP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sQZLQP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sQZNIP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sQZPAP8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sQZP4P8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sQZP4P8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV";

let queue: QueueItem[] = [];
let playing = false;
let generation = 0;
let audioEl: HTMLAudioElement | null = null;
let unlocked = false;
let errorHandler: ((msg: string) => void) | null = null;
let lastErrorMessage = "";

function ensureAudioEl(): HTMLAudioElement {
  if (!audioEl) {
    audioEl = new Audio();
    audioEl.preload = "auto";
  }
  return audioEl;
}

function reportError(msg: string) {
  if (msg === lastErrorMessage) return; // dedupe identical consecutive errors
  lastErrorMessage = msg;
  errorHandler?.(msg);
}

async function fetchTts(text: string): Promise<Blob | null> {
  try {
    const r = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!r.ok) {
      const bodyText = await r.text().catch(() => "");
      reportError(`语音合成失败（${r.status}）：${bodyText.slice(0, 300)}`);
      return null;
    }
    return await r.blob();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "网络错误";
    reportError(`语音合成失败：${msg}`);
    return null;
  }
}

async function pump() {
  if (playing) return;
  playing = true;
  try {
    while (queue.length > 0) {
      const item = queue.shift()!;
      if (item.generation !== generation) continue;
      const blob = await item.audioPromise;
      if (!blob || item.generation !== generation) continue;

      const url = URL.createObjectURL(blob);
      const el = ensureAudioEl();
      el.src = url;
      try {
        await new Promise<void>((resolve, reject) => {
          const onEnded = () => {
            cleanup();
            resolve();
          };
          const onError = () => {
            cleanup();
            reject(new Error("audio playback failed"));
          };
          function cleanup() {
            el.removeEventListener("ended", onEnded);
            el.removeEventListener("error", onError);
            URL.revokeObjectURL(url);
          }
          el.addEventListener("ended", onEnded);
          el.addEventListener("error", onError);
          el.play().catch((err) => {
            cleanup();
            reject(err);
          });
        });
      } catch {
        URL.revokeObjectURL(url);
        // Skip and continue the queue.
      }
    }
  } finally {
    playing = false;
  }
}

export const ttsQueue = {
  enqueue(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const item: QueueItem = {
      generation,
      text: trimmed,
      audioPromise: fetchTts(trimmed),
    };
    queue.push(item);
    void pump();
  },

  clear() {
    generation++;
    queue = [];
    lastErrorMessage = "";
    if (audioEl) {
      try {
        audioEl.pause();
        audioEl.removeAttribute("src");
        audioEl.load();
      } catch {
        // ignore
      }
    }
    playing = false;
  },

  setErrorHandler(handler: ((msg: string) => void) | null) {
    errorHandler = handler;
  },

  // Plays a tiny silent clip during a user gesture so subsequent auto-play
  // works on iOS Safari and locked Chrome autoplay policies.
  unlockAutoplay() {
    if (unlocked) return;
    const el = ensureAudioEl();
    el.src = SILENT_MP3;
    el.muted = false;
    el.volume = 1;
    el.play()
      .then(() => {
        unlocked = true;
        el.pause();
        try {
          el.removeAttribute("src");
          el.load();
        } catch {
          // ignore
        }
      })
      .catch(() => {
        // Will retry on the next user gesture.
      });
  },

  get isUnlocked() {
    return unlocked;
  },
};
