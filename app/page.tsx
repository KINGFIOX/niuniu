"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatInput } from "@/components/ChatInput";
import { ChatWindow } from "@/components/ChatWindow";
import { ModuleSwitcher } from "@/components/ModuleSwitcher";
import { TtsToggle } from "@/components/TtsToggle";
import type { ChatMessage } from "@/components/MessageBubble";
import {
  DEFAULT_MODULE_ID,
  MODULE_INDEX,
  MODULES,
  WELCOME_MESSAGE,
  type ModuleId,
} from "@/lib/systemPrompt";
import { ttsQueue } from "@/lib/ttsQueue";

const HISTORY_KEY = "niuniu-zoo-chat-history-v1";
const MODULE_KEY = "niuniu-zoo-chat-current-module-v1";
const TTS_KEY = "niuniu-zoo-chat-auto-tts-v1";

const initialMessages: ChatMessage[] = [
  { role: "assistant", content: WELCOME_MESSAGE },
];

const SENTENCE_END_RE = /[。！？!?\n.]/g;

function isModuleId(v: unknown): v is ModuleId {
  return typeof v === "string" && v in MODULE_INDEX;
}

// Scan `full` from `fromIdx` for sentence-ending punctuation; enqueue each
// completed sentence into the TTS queue. Returns the new "spoken-to" cursor.
function flushSentencesForTts(
  full: string,
  fromIdx: number,
  minLen = 4,
): number {
  let lastIdx = fromIdx;
  SENTENCE_END_RE.lastIndex = fromIdx;
  let match: RegExpExecArray | null;
  while ((match = SENTENCE_END_RE.exec(full))) {
    const end = match.index + 1;
    const sentence = full.slice(lastIdx, end).trim();
    if (sentence.length >= minLen) {
      ttsQueue.enqueue(sentence);
    }
    lastIdx = end;
  }
  return lastIdx;
}

export default function Page() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moduleId, setModuleId] = useState<ModuleId>(DEFAULT_MODULE_ID);
  const [autoTts, setAutoTts] = useState<boolean>(true);
  const abortRef = useRef<AbortController | null>(null);
  const autoTtsRef = useRef(autoTts);

  useEffect(() => {
    autoTtsRef.current = autoTts;
  }, [autoTts]);

  useEffect(() => {
    ttsQueue.setErrorHandler((msg) => setError(msg));
    return () => ttsQueue.setErrorHandler(null);
  }, []);

  useEffect(() => {
    try {
      const rawHistory = localStorage.getItem(HISTORY_KEY);
      if (rawHistory) {
        const parsed = JSON.parse(rawHistory) as ChatMessage[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      }
    } catch {
      // ignore
    }
    try {
      const rawMod = localStorage.getItem(MODULE_KEY);
      if (isModuleId(rawMod)) setModuleId(rawMod);
    } catch {
      // ignore
    }
    try {
      const rawTts = localStorage.getItem(TTS_KEY);
      if (rawTts === "0" || rawTts === "false") setAutoTts(false);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages]);

  useEffect(() => {
    try {
      localStorage.setItem(MODULE_KEY, moduleId);
    } catch {
      // ignore
    }
  }, [moduleId]);

  useEffect(() => {
    try {
      localStorage.setItem(TTS_KEY, autoTts ? "1" : "0");
    } catch {
      // ignore
    }
    if (!autoTts) ttsQueue.clear();
  }, [autoTts]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    ttsQueue.clear();
  }, []);

  const handleClear = useCallback(() => {
    abortRef.current?.abort();
    ttsQueue.clear();
    setMessages(initialMessages);
    setStreaming(null);
    setError(null);
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      // ignore
    }
  }, []);

  const handleUserGesture = useCallback(() => {
    ttsQueue.unlockAutoplay();
  }, []);

  const handleModuleChange = useCallback((id: ModuleId) => {
    setModuleId(id);
    ttsQueue.clear();
  }, []);

  const handleSend = useCallback(
    async (text: string) => {
      setError(null);
      ttsQueue.clear();
      const userMsg: ChatMessage = { role: "user", content: text };
      const nextHistory = [...messages, userMsg];
      setMessages(nextHistory);
      setStreaming("");

      const controller = new AbortController();
      abortRef.current = controller;

      let spokenUpto = 0;

      try {
        const resp = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: nextHistory, moduleId }),
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
              const delta: string | undefined =
                json?.choices?.[0]?.delta?.content;
              if (typeof delta === "string" && delta.length > 0) {
                assistantText += delta;
                setStreaming(assistantText);
                if (autoTtsRef.current) {
                  spokenUpto = flushSentencesForTts(assistantText, spokenUpto);
                }
              }
            } catch {
              // ignore non-JSON keepalive lines
            }
          }
        }

        if (assistantText.length > 0) {
          // Flush any trailing partial sentence the stream ended without
          // punctuation.
          if (
            autoTtsRef.current &&
            assistantText.length > spokenUpto
          ) {
            const tail = assistantText.slice(spokenUpto).trim();
            if (tail.length > 0) ttsQueue.enqueue(tail);
          }
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
    [messages, moduleId],
  );

  const handleVoice = useCallback(
    async (wav: Blob) => {
      setError(null);
      const form = new FormData();
      form.append("audio", wav, "voice.wav");
      try {
        const resp = await fetch("/api/stt", { method: "POST", body: form });
        if (!resp.ok) {
          const errBody = await resp.text().catch(() => "");
          throw new Error(
            `语音识别失败（${resp.status}）：${errBody.slice(0, 200)}`,
          );
        }
        const { text } = (await resp.json()) as { text?: string };
        if (!text || !text.trim()) {
          setError("没听清楚呀，请再说一次试试");
          return;
        }
        await handleSend(text.trim());
      } catch (e) {
        const msg = e instanceof Error ? e.message : "语音识别失败";
        setError(msg);
      }
    },
    [handleSend],
  );

  const isStreaming = streaming !== null;

  const currentModule = useMemo(
    () => MODULE_INDEX[moduleId] ?? MODULES[0],
    [moduleId],
  );
  const subtitle = `动物园游记 · ${currentModule.short}`;

  return (
    <main className="min-h-dvh flex flex-col px-3 sm:px-6 py-3 sm:py-5 gap-3 max-w-3xl mx-auto">
      <ChatWindow
        messages={messages}
        streamingAssistant={streaming}
        onClear={handleClear}
        subtitle={subtitle}
        ttsToggle={<TtsToggle value={autoTts} onChange={setAutoTts} />}
        moduleSwitcher={
          <ModuleSwitcher
            value={moduleId}
            onChange={handleModuleChange}
            disabled={isStreaming}
          />
        }
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
        onVoice={handleVoice}
        onStop={handleStop}
        onUserGesture={handleUserGesture}
      />
      <p className="text-center text-xs text-gray-400">
        模型：DeepSeek-R1 · 语音：火山引擎 · 本站对话仅用于教学演示
      </p>
    </main>
  );
}
