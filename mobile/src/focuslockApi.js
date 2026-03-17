const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || "").trim().replace(/\/$/, "");

function buildUrl(path) {
  if (!path.startsWith("/")) {
    throw new Error("Rota de API invalida");
  }

  if (!API_BASE_URL) {
    throw new Error("EXPO_PUBLIC_API_BASE_URL nao configurada no app mobile");
  }

  return `${API_BASE_URL}${path}`;
}

async function postJson(path, body) {
  const response = await fetch(buildUrl(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error || `Falha de API (${response.status})`);
  }

  return payload;
}

export function isApiConfigured() {
  return Boolean(API_BASE_URL);
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export async function analyzeOnboarding(answers) {
  return postJson("/api/onboarding", { answers });
}

export async function verifyEvidence({ imageBase64, imageMimeType = "image/jpeg", activeTask, history, profile }) {
  return postJson("/api/verify", {
    imageBase64,
    imageMimeType,
    activeTask,
    history,
    profile,
  });
}
