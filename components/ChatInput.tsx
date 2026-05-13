"use client";

import { FormEvent, KeyboardEvent, useRef, useState } from "react";

type Props = {
  disabled?: boolean;
  onSend: (text: string) => void;
  onStop?: () => void;
  isStreaming?: boolean;
};

export function ChatInput({ disabled, onSend, onStop, isStreaming }: Props) {
  const [value, setValue] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
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

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-2 bg-white/90 backdrop-blur rounded-3xl shadow-bubble border border-niuniu-pinkSoft p-2"
    >
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        rows={1}
        placeholder="告诉妞妞，你看到了什么呀…"
        disabled={disabled}
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
          disabled={disabled || !value.trim()}
          className="shrink-0 h-11 px-5 rounded-2xl bg-niuniu-pink text-white font-semibold shadow-bubble disabled:opacity-40 active:scale-95 transition"
        >
          发送
        </button>
      )}
    </form>
  );
}
