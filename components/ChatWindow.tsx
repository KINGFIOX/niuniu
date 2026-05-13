"use client";

import Image from "next/image";
import { ReactNode, useEffect, useRef } from "react";
import { MessageBubble, type ChatMessage } from "./MessageBubble";

type Props = {
  messages: ChatMessage[];
  streamingAssistant?: string | null;
  onClear?: () => void;
  subtitle?: string;
  moduleSwitcher?: ReactNode;
};

export function ChatWindow({
  messages,
  streamingAssistant,
  onClear,
  subtitle,
  moduleSwitcher,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, streamingAssistant]);

  return (
    <div className="relative flex-1 min-h-0 overflow-hidden rounded-3xl shadow-bubble">
      <div className="absolute inset-0">
        <Image
          src="/zoo-bg.png"
          alt="动物园背景"
          fill
          sizes="100vw"
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-white/55" />
      </div>

      <header className="relative z-30 flex items-center gap-3 px-4 py-3 bg-white/70 backdrop-blur border-b border-niuniu-pinkSoft">
        <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-niuniu-pink bg-white">
          <Image
            src="/niuniu-avatar.png"
            alt="妞妞导游"
            width={80}
            height={80}
            className="w-full h-full object-cover"
            priority
          />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="font-bold text-gray-800">妞妞导游</span>
          <span className="text-xs text-gray-500 truncate">
            {subtitle ?? "动物园游记 · 语言训练"}
          </span>
        </div>
        <div className="flex-1" />
        {moduleSwitcher}
        {onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="text-xs px-3 py-1.5 rounded-full bg-white/80 border border-niuniu-pinkSoft text-niuniu-pink hover:bg-niuniu-pinkSoft transition"
          >
            重新开始
          </button>
        ) : null}
      </header>

      <div
        ref={scrollRef}
        className="chat-scroll relative z-10 h-[calc(100%-64px)] overflow-y-auto px-4 py-5 space-y-4"
      >
        {messages.map((m, i) => (
          <MessageBubble key={i} message={m} />
        ))}
        {streamingAssistant !== null && streamingAssistant !== undefined ? (
          <MessageBubble
            message={{ role: "assistant", content: streamingAssistant }}
            isStreaming
          />
        ) : null}
      </div>
    </div>
  );
}
