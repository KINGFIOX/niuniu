import {
  DEFAULT_MODULE_ID,
  MODULE_INDEX,
  type ModuleId,
} from "@/lib/systemPrompt";

export const runtime = "edge";

const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";

// Switch between "deepseek-reasoner" (R1, slower/pricier) and
// "deepseek-chat" (V3, fast/cheaper) by env var, default = R1 per spec.
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-reasoner";

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

function resolveModule(moduleId: unknown) {
  if (typeof moduleId === "string" && moduleId in MODULE_INDEX) {
    return MODULE_INDEX[moduleId as ModuleId];
  }
  return MODULE_INDEX[DEFAULT_MODULE_ID];
}

export async function POST(req: Request) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Server missing DEEPSEEK_API_KEY" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  let body: { messages?: ChatMessage[]; moduleId?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const incoming = Array.isArray(body.messages) ? body.messages : [];
  // Strip any client-supplied system role to prevent prompt injection.
  const safeMessages = incoming.filter(
    (m) =>
      m &&
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string",
  );

  if (safeMessages.length === 0) {
    return new Response(JSON.stringify({ error: "messages is empty" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const mod = resolveModule(body.moduleId);

  const upstream = await fetch(DEEPSEEK_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      messages: [
        { role: "system", content: mod.systemPrompt },
        ...safeMessages,
      ],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => "");
    return new Response(
      JSON.stringify({
        error: "DeepSeek upstream error",
        status: upstream.status,
        detail: errText.slice(0, 500),
      }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }

  // Pass the SSE stream through unchanged. Frontend parses the OpenAI-style
  // `data: {...}` lines and reads choices[0].delta.content. `reasoning_content`
  // (R1 thinking) is intentionally ignored on the client.
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Module-Id": mod.id,
    },
  });
}
