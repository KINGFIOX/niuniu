"use client";

import {
  FormEvent,
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { PcmRecorder } from "@/lib/pcmRecorder";

type Props = {
  disabled?: boolean;
  onSend: (text: string) => void;
  onVoice?: (wav: Blob) => void;
  onStop?: () => void;
  onUserGesture?: () => void;
  isStreaming?: boolean;
};

type MicState = "idle" | "recording" | "processing";

export function ChatInput({
  disabled,
  onSend,
  onVoice,
  onStop,
  onUserGesture,
  isStreaming,
}: Props) {
  const [value, setValue] = useState("");
  const [micState, setMicState] = useState<MicState>("idle");
  const [micError, setMicError] = useState<string | null>(null);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const recorderRef = useRef<PcmRecorder | null>(null);
  const pressedRef = useRef(false);

  useEffect(() => {
    setVoiceSupported(PcmRecorder.isSupported);
  }, []);

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    onUserGesture?.();
    onSend(text);
    setValue("");
    requestAnimationFrame(() => {
      if (taRef.current) taRef.current.style.height = "auto";
    });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    submit();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  function handleInput() {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }

  async function startRecording() {
    if (!voiceSupported || disabled || micState !== "idle") return;
    setMicError(null);
    onUserGesture?.();
    const recorder = new PcmRecorder();
    try {
      await recorder.start();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "无法开始录音";
      setMicError(
        msg.includes("Permission") || msg.includes("NotAllowed")
          ? "请允许麦克风权限后再试"
          : msg,
      );
      return;
    }
    recorderRef.current = recorder;
    setMicState("recording");
  }

  async function finishRecording() {
    if (!recorderRef.current || micState !== "recording") return;
    setMicState("processing");
    let blob: Blob | null = null;
    try {
      blob = await recorderRef.current.stop();
    } catch {
      // ignore
    }
    recorderRef.current = null;
    if (blob && blob.size > 1024 && onVoice) {
      onVoice(blob);
    }
    setMicState("idle");
  }

  function cancelRecording() {
    if (recorderRef.current) {
      recorderRef.current.abort();
      recorderRef.current = null;
    }
    setMicState("idle");
  }

  function onMicPointerDown(e: ReactPointerEvent<HTMLButtonElement>) {
    if (!voiceSupported) return;
    pressedRef.current = true;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    void startRecording();
  }
  function onMicPointerUp(e: ReactPointerEvent<HTMLButtonElement>) {
    if (!pressedRef.current) return;
    pressedRef.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    void finishRecording();
  }
  function onMicPointerCancel() {
    if (!pressedRef.current) return;
    pressedRef.current = false;
    cancelRecording();
  }

  const recording = micState === "recording";
  const placeholder = recording
    ? "正在听你说……松开手指就好"
    : micState === "processing"
      ? "妞妞在听明白你说的话……"
      : "告诉妞妞，你看到了什么呀…";

  return (
    <div className="flex flex-col gap-1">
      <form
        onSubmit={handleSubmit}
        className={`flex items-end gap-2 bg-white/90 backdrop-blur rounded-3xl shadow-bubble border p-2 transition ${
          recording ? "border-red-400" : "border-niuniu-pinkSoft"
        }`}
      >
        {voiceSupported && onVoice ? (
          <button
            type="button"
            onPointerDown={onMicPointerDown}
            onPointerUp={onMicPointerUp}
            onPointerLeave={onMicPointerUp}
            onPointerCancel={onMicPointerCancel}
            disabled={disabled && !recording}
            aria-label={recording ? "松开发送语音" : "按住说话"}
            title={recording ? "松开发送语音" : "按住说话"}
            className={`shrink-0 h-11 w-11 rounded-full flex items-center justify-center transition active:scale-95 ${
              recording
                ? "bg-red-500 text-white shadow-bubble animate-pulse"
                : micState === "processing"
                  ? "bg-gray-200 text-gray-500"
                  : "bg-niuniu-pinkSoft text-niuniu-pink hover:bg-niuniu-pink hover:text-white"
            } disabled:opacity-40`}
          >
            <MicIcon />
          </button>
        ) : null}

        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          rows={1}
          placeholder={placeholder}
          disabled={disabled || recording || micState === "processing"}
          className="flex-1 resize-none bg-transparent outline-none px-3 py-2 text-[15px] leading-6 placeholder:text-gray-400 max-h-[140px]"
        />

        {isStreaming ? (
          <button
            type="button"
            onClick={onStop}
            className="shrink-0 h-11 px-4 rounded-2xl bg-gray-300 text-gray-700 font-semibold active:scale-95 transition"
          >
            停止
          </button>
        ) : (
          <button
            type="submit"
            disabled={disabled || !value.trim() || recording}
            className="shrink-0 h-11 px-5 rounded-2xl bg-niuniu-pink text-white font-semibold shadow-bubble disabled:opacity-40 active:scale-95 transition"
          >
            发送
          </button>
        )}
      </form>

      {micError ? (
        <p className="text-xs text-red-500 px-3">{micError}</p>
      ) : null}
    </div>
  );
}

function MicIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-5 h-5"
      aria-hidden
    >
      <path d="M12 14a3 3 0 003-3V6a3 3 0 10-6 0v5a3 3 0 003 3z" />
      <path d="M19 11a1 1 0 10-2 0 5 5 0 11-10 0 1 1 0 10-2 0 7 7 0 006 6.92V20H8a1 1 0 100 2h8a1 1 0 100-2h-3v-2.08A7 7 0 0019 11z" />
    </svg>
  );
}
