"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatInput } from "@/components/ChatInput";
import { ChatWindow } from "@/components/ChatWindow";
import type { ChatMessage } from "@/components/MessageBubble";
import { WELCOME_MESSAGE } from "@/lib/systemPrompt";

const STORAGE_KEY = "niuniu-zoo-chat-history-v1";

const initialMessages: ChatMessage[] = [
  { role: "assistant", content: WELCOME_MESSAGE },
];

export default function Page() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ChatMessage[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      }
    } catch {
      // ignore corrupted history
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // quota or private mode; ignore
    }
  }, [messages]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleClear = useCallback(() => {
    abortRef.current?.abort();
    setMessages(initialMessages);
    setStreaming(null);
    setError(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const handleSend = useCallback(
    async (text: string) => {
      setError(null);
      const userMsg: ChatMessage = { role: "user", content: text };
      // Only send real conversation turns to the backend; the local welcome
      // message is a UI-only greeting and doesn't need to count against tokens,
      // but we keep it in history so the model can see context after the
      // first user reply.
      const nextHistory = [...messages, userMsg];
      setMessages(nextHistory);
      setStreaming("");

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const resp = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: nextHistory }),
          signal: controller.signal,
        });

        if (!resp.ok || !resp.body) {
          const errText = await resp.text().catch(() => "");
          throw new Error(
            `服务器出错（${resp.status}）：${errText.slice(0, 200) || "请稍后再试"}`,
          );
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let assistantText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (data === "[DONE]") continue;
            try {
              const json = JSON.parse(data);
              const delta: string | undefined = json?.choices?.[0]?.delta?.content;
              if (typeof delta === "string" && delta.length > 0) {
                assistantText += delta;
                setStreaming(assistantText);
              }
            } catch {
              // ignore non-JSON keepalive lines
            }
          }
        }

        if (assistantText.length > 0) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: assistantText },
          ]);
        }
        setStreaming(null);
      } catch (e: unknown) {
        const isAbort =
          (e instanceof DOMException && e.name === "AbortError") ||
          (e instanceof Error && e.name === "AbortError");
        if (!isAbort) {
          const msg = e instanceof Error ? e.message : "网络错误，请稍后再试";
          setError(msg);
        }
        setStreaming(null);
      } finally {
        abortRef.current = null;
      }
    },
    [messages],
  );

  const isStreaming = streaming !== null;

  return (
    <main className="min-h-dvh flex flex-col px-3 sm:px-6 py-3 sm:py-5 gap-3 max-w-3xl mx-auto">
      <ChatWindow
        messages={messages}
        streamingAssistant={streaming}
        onClear={handleClear}
      />
      {error ? (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-2xl px-4 py-2">
          {error}
        </div>
      ) : null}
      <ChatInput
        disabled={isStreaming}
        isStreaming={isStreaming}
        onSend={handleSend}
        onStop={handleStop}
      />
    </main>
  );
}
