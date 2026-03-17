import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { hasAnthropicApiKey, parseJsonFromModelText, sendAnthropicMessage } from "@/lib/anthropicClient";

export const runtime = "nodejs";

const DEFAULT_THRESHOLD = Number(process.env.AI_CONFIDENCE_THRESHOLD || 60);

function clampScore(value) {
  const score = Number(value);

  if (Number.isNaN(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function toSafeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function extractImagePayload(body = {}) {
  if (typeof body.imageDataUrl === "string" && body.imageDataUrl.startsWith("data:")) {
    const match = body.imageDataUrl.match(/^data:(.+);base64,(.+)$/);

    if (match) {
      return {
        mimeType: match[1],
        base64: match[2],
      };
    }
  }

  if (typeof body.imageBase64 === "string" && body.imageBase64.trim()) {
    return {
      mimeType: body.imageMimeType || "image/jpeg",
      base64: body.imageBase64.trim(),
    };
  }

  return null;
}

function normalizeTask(task = {}) {
  return {
    id: task.id || null,
    nome: toSafeString(task.name || task.nome, "Tarefa sem nome"),
    descricao_evidencia: toSafeString(task.evidence || task.desc || task.descricao_evidencia, "Evidencia visual da tarefa concluida"),
    categoria: toSafeString(task.category || task.categoria, "work"),
    horario_comprometido: toSafeString(task.time || task.horario, ""),
  };
}

function mapHistoryItem(item = {}) {
  return {
    tarefa: toSafeString(item.task || item.tarefa || item.tarefa_nome, ""),
    categoria: toSafeString(item.category || item.categoria, ""),
    aprovado: Boolean(item.approved ?? item.aprovado),
    confianca: clampScore(item.confidence ?? item.confianca),
    notas: toSafeString(item.notes || item.notas_aprendizado || item.notas, ""),
  };
}

function selectRelevantHistory(history = [], category = "") {
  const clean = history.filter((item) => item && typeof item === "object").map(mapHistoryItem);

  const sameCategory = clean.filter((item) => item.categoria === category).slice(0, 20);
  const otherCategories = clean.filter((item) => item.categoria !== category).slice(0, 10);

  return [...sameCategory, ...otherCategories];
}

function normalizeVerification(raw = {}, threshold = DEFAULT_THRESHOLD) {
  const confianca = clampScore(raw.confianca);
  const aprovadoDoModelo = typeof raw.aprovado === "boolean" ? raw.aprovado : confianca >= threshold;
  const aprovado = aprovadoDoModelo && confianca >= threshold;

  const reasonFromThreshold = !aprovado && confianca < threshold ? `Confianca abaixo do minimo (${threshold}).` : null;

  return {
    aprovado,
    confianca,
    mensagem: toSafeString(raw.mensagem, aprovado ? "Evidencia aceita." : "Evidencia insuficiente. Tente novamente."),
    ocr_detectado: toSafeString(raw.ocr_detectado),
    objetos_detectados: Array.isArray(raw.objetos_detectados)
      ? raw.objetos_detectados.filter((item) => typeof item === "string" && item.trim())
      : [],
    notas_aprendizado: toSafeString(raw.notas_aprendizado),
    motivo_rejeicao: aprovado ? null : toSafeString(raw.motivo_rejeicao, reasonFromThreshold || "Evidencia insuficiente."),
    threshold,
  };
}

function buildPrompt({ task, history, profile }) {
  return [
    "Contexto da verificacao FocusLock:",
    JSON.stringify(
      {
        contexto: task,
        historico_aprendizado: history,
        perfil_usuario: profile || {},
      },
      null,
      2,
    ),
    "",
    "Responda com JSON no formato:",
    JSON.stringify(
      {
        aprovado: true,
        confianca: 0,
        mensagem: "string",
        ocr_detectado: "string",
        objetos_detectados: ["string"],
        notas_aprendizado: "string",
        motivo_rejeicao: null,
      },
      null,
      2,
    ),
    "",
    "Regras:",
    "- Seja justo e nao punitivo: aceite evidencia razoavel.",
    "- Rejeite atalho obvio (foto de tela/foto de foto).",
    "- Se faltar evidencia, explique como melhorar a proxima foto.",
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

  const imagePayload = extractImagePayload(body);

  if (!imagePayload?.base64) {
    return NextResponse.json({ error: "Imagem em base64 obrigatoria" }, { status: 400 });
  }

  if (!hasAnthropicApiKey()) {
    return NextResponse.json(
      {
        error: "ANTHROPIC_API_KEY nao configurada no servidor",
      },
      { status: 503 },
    );
  }

  const task = normalizeTask(body.activeTask || body.contexto || {});
  const history = selectRelevantHistory(body.history || body.historico_aprendizado || [], task.categoria);
  const profile = body.profile || body.perfil_usuario || {};
  let imageHash;

  try {
    imageHash = createHash("sha256").update(Buffer.from(imagePayload.base64, "base64")).digest("hex");
  } catch {
    return NextResponse.json({ error: "Imagem base64 invalida" }, { status: 400 });
  }

  try {
    const rawText = await sendAnthropicMessage({
      system: [
        "Voce e o verificador de tarefas do FocusLock.",
        "Analise a imagem como evidencia de conclusao de tarefa no mundo real.",
        "Use o contexto e o historico para calibrar consistencia.",
        "Retorne apenas JSON valido, sem markdown.",
      ].join(" "),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: buildPrompt({ task, history, profile }),
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: imagePayload.mimeType,
                data: imagePayload.base64,
              },
            },
          ],
        },
      ],
      temperature: 0.2,
      maxTokens: 900,
    });

    const parsed = parseJsonFromModelText(rawText);
    const verification = normalizeVerification(parsed, DEFAULT_THRESHOLD);

    return NextResponse.json({
      verification: {
        ...verification,
        image_hash: imageHash,
      },
      source: "anthropic",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: `Falha ao verificar evidencia: ${error.message}`,
      },
      { status: 502 },
    );
  }
}
