import Image from "next/image";

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

type Props = {
  message: ChatMessage;
  isStreaming?: boolean;
};

export function MessageBubble({ message, isStreaming }: Props) {
  const isAssistant = message.role === "assistant";

  if (isAssistant) {
    return (
      <div className="flex items-end gap-2 max-w-full">
        <div className="shrink-0 w-12 h-12 rounded-full bg-white shadow-bubble overflow-hidden border-2 border-niuniu-pink">
          <Image
            src="/niuniu-avatar.png"
            alt="妞妞"
            width={96}
            height={96}
            className="w-full h-full object-cover"
            priority
          />
        </div>
        <div className="relative bg-white/95 text-gray-800 rounded-2xl rounded-bl-md px-4 py-3 shadow-bubble max-w-[78%] whitespace-pre-wrap leading-relaxed text-[15px]">
          {message.content || (isStreaming ? <TypingDots /> : "")}
          {isStreaming && message.content ? (
            <span className="inline-block w-1.5 h-4 ml-0.5 bg-niuniu-pink align-middle animate-pulse" />
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-end max-w-full">
      <div className="bg-niuniu-pink text-white rounded-2xl rounded-br-md px-4 py-3 shadow-bubble max-w-[78%] whitespace-pre-wrap leading-relaxed text-[15px]">
        {message.content}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1">
      <span className="typing-dot w-2 h-2 rounded-full bg-niuniu-pink" />
      <span className="typing-dot w-2 h-2 rounded-full bg-niuniu-pink" />
      <span className="typing-dot w-2 h-2 rounded-full bg-niuniu-pink" />
    </span>
  );
}
