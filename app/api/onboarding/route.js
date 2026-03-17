import { NextResponse } from "next/server";
import { hasAnthropicApiKey, parseJsonFromModelText, sendAnthropicMessage } from "@/lib/anthropicClient";

export const runtime = "nodejs";

function inferLocalProfile(answers = {}) {
  const distraction = String(answers.distraction || "As vezes").toLowerCase();
  const impulse = String(answers.impulse || "Ocasionalmente").toLowerCase();
  const procrastination = String(answers.procrastination || "Vou com esforco").toLowerCase();
  const peak = answers.peak || "Manha";
  const goal = answers.goal || "Foco";

  const highSignals = [distraction, impulse, procrastination].filter(
    (value) =>
      value.includes("sempre") ||
      value.includes("automatic") ||
      value.includes("frequencia") ||
      value.includes("procrastino") ||
      value.includes("evito") ||
      value.includes("bastante"),
  ).length;

  const nivel = highSignals >= 2 ? "alto" : highSignals === 1 ? "medio" : "baixo";

  const tipo =
    nivel === "alto"
      ? "Mente Acelerada"
      : nivel === "medio"
        ? "Foco Intermitente"
        : "Foco Estruturado";

  return {
    tipo,
    subtitulo: "Friccao intencional para manter o compromisso com voce.",
    nivel_impulsividade: nivel,
    nivel,
    pico_produtividade: peak,
    pico: peak,
    estrategia:
      goal === "Saude"
        ? "Use blocos curtos e prova visual simples para manter consistencia diaria."
        : "Divida em blocos de 20-40 minutos, dispare bloqueio no horario e valide por evidencia.",
    cor_tema: nivel === "alto" ? "#e8552a" : nivel === "medio" ? "#0e8f69" : "#1f6feb",
    icone: nivel === "alto" ? "flame" : nivel === "medio" ? "target" : "shield",
    blocos_sugeridos: ["Foco profundo 25min", "Entrega de tarefa critica", "Fechamento do dia sem tela"],
    criado_em: new Date().toISOString(),
    versao_onboarding: 1,
  };
}

function normalizeProfile(raw, fallback) {
  const nivelRaw = String(raw?.nivel_impulsividade || raw?.nivel || fallback.nivel_impulsividade || "medio").toLowerCase();
  const nivel = ["baixo", "medio", "alto"].includes(nivelRaw) ? nivelRaw : "medio";
  const peak = raw?.pico_produtividade || raw?.pico || fallback.pico_produtividade;

  const blocks = Array.isArray(raw?.blocos_sugeridos)
    ? raw.blocos_sugeridos.filter(Boolean).slice(0, 5)
    : fallback.blocos_sugeridos;

  return {
    tipo: raw?.tipo || fallback.tipo,
    subtitulo: raw?.subtitulo || fallback.subtitulo,
    nivel_impulsividade: nivel,
    nivel,
    pico_produtividade: peak,
    pico: peak,
    estrategia: raw?.estrategia || fallback.estrategia,
    cor_tema: raw?.cor_tema || fallback.cor_tema,
    icone: raw?.icone || fallback.icone,
    blocos_sugeridos: blocks?.length ? blocks : fallback.blocos_sugeridos,
    criado_em: new Date().toISOString(),
    versao_onboarding: 1,
  };
}

function buildOnboardingPrompt(answers = {}) {
  return [
    "Respostas do usuario para onboarding comportamental do FocusLock:",
    JSON.stringify(answers, null, 2),
    "",
    "Retorne um JSON no formato:",
    JSON.stringify(
      {
        tipo: "string",
        subtitulo: "string",
        nivel_impulsividade: "baixo|medio|alto",
        pico_produtividade: "string",
        estrategia: "string",
        cor_tema: "#hex",
        icone: "string",
        blocos_sugeridos: ["string", "string", "string"],
      },
      null,
      2,
    ),
    "",
    "Regras:",
    "- Linguagem curta, direta e motivadora (pt-BR).",
    "- Sem termos clinicos e sem diagnostico medico.",
    "- Estrategia deve ser acionavel em 1-2 frases.",
    "- Retorne apenas JSON valido.",
  ].join("\n");
}

export async function POST(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const answers = body?.answers;

  if (!answers || typeof answers !== "object" || Array.isArray(answers) || Object.keys(answers).length === 0) {
    return NextResponse.json({ error: "Campo answers obrigatorio" }, { status: 400 });
  }

  const fallback = inferLocalProfile(answers);

  if (!hasAnthropicApiKey()) {
    return NextResponse.json({
      profile: fallback,
      source: "fallback",
      warning: "ANTHROPIC_API_KEY nao configurada. Perfil gerado localmente.",
    });
  }

  try {
    const rawText = await sendAnthropicMessage({
      system:
        "Voce gera perfis de onboarding comportamental para o app FocusLock. Retorne apenas JSON valido, sem markdown.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: buildOnboardingPrompt(answers),
            },
          ],
        },
      ],
      temperature: 0.4,
      maxTokens: 800,
    });

    const parsed = parseJsonFromModelText(rawText);
    const profile = normalizeProfile(parsed, fallback);

    return NextResponse.json({ profile, source: "anthropic" });
  } catch (error) {
    return NextResponse.json({
      profile: fallback,
      source: "fallback",
      warning: `Falha na IA de onboarding: ${error.message}`,
    });
  }
}
