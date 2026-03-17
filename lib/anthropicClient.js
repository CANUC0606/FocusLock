const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

function readAnthropicApiKey() {
  // Fallback for common typo in env var name used in hosted secrets.
  const primary = (process.env.ANTHROPIC_API_KEY || "").trim();
  const secondary = (process.env.ANTROPIC_API_KEY || "").trim();

  const candidates = [primary, secondary].filter(Boolean);
  const likelyRealKey = candidates.find(
    (key) => key.startsWith("sk-ant-") && !/\.\.\.|example|changeme|your|sua|aqui/i.test(key),
  );

  return likelyRealKey || candidates[0] || "";
}

export function hasAnthropicApiKey() {
  return Boolean(readAnthropicApiKey());
}

export async function sendAnthropicMessage({
  system,
  messages,
  maxTokens = Number(process.env.AI_MAX_TOKENS || 1000),
  temperature = 0.2,
  model = DEFAULT_MODEL,
}) {
  const apiKey = readAnthropicApiKey();

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY nao configurada");
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      system,
      max_tokens: maxTokens,
      temperature,
      messages,
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload?.error?.message || "Falha ao chamar Anthropic";
    throw new Error(message);
  }

  const rawText =
    Array.isArray(payload?.content) && payload.content.length > 0
      ? payload.content.filter((block) => block?.type === "text").map((block) => block.text || "").join("\n")
      : "";

  if (!rawText.trim()) {
    throw new Error("Resposta da Anthropic sem bloco de texto");
  }

  return rawText;
}

export function parseJsonFromModelText(rawText) {
  const trimmed = (rawText || "").trim();
  const unwrapped = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(unwrapped);
  } catch {
    const start = unwrapped.indexOf("{");
    const end = unwrapped.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) {
      throw new Error("Modelo nao retornou JSON valido");
    }

    return JSON.parse(unwrapped.slice(start, end + 1));
  }
}
