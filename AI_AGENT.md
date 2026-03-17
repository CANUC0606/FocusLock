# AI_AGENT.md — Agente de Verificação FocusLock

## Especificação técnica do agente de visão, OCR e aprendizado adaptativo

---

## 1. Visão Geral do Agente

O agente de verificação é o núcleo do produto. Ele recebe uma imagem e um contexto, e decide se a tarefa foi concluída. Mais importante: **ele aprende com cada decisão**, tornando-se progressivamente mais preciso para cada usuário.

### Responsabilidades do agente

1. Analisar a imagem com visão computacional
2. Extrair texto via OCR quando relevante
3. Cruzar evidência visual com a descrição da tarefa
4. Usar histórico de verificações anteriores para calibrar o julgamento
5. Retornar decisão estruturada com metadados de aprendizado

---

## 2. Input do Agente

### 2.1 Estrutura da requisição

```json
{
  "imagem": "base64 JPEG",
  "contexto": {
    "tarefa_nome": "Ler 20 páginas do livro",
    "tarefa_descricao_evidencia": "Foto do livro aberto na página alvo",
    "categoria": "study",
    "horario_comprometido": "15:00"
  },
  "historico_aprendizado": [
    {
      "tarefa": "Ler 20 páginas",
      "aprovado": true,
      "confianca": 91,
      "notas": "Livro aberto com marcador visível foi aceito"
    },
    {
      "tarefa": "Arrumar mesa",
      "aprovado": false,
      "confianca": 34,
      "notas": "Foto muito escura, mesa fora de foco"
    }
  ],
  "perfil_usuario": {
    "nivel_impulsividade": "alto",
    "historico_tentativas_anteriores": 2
  }
}
```

### 2.2 O que o agente analisa

**Análise visual:**
- Presença de objetos relevantes para a tarefa
- Contexto ambiental (localização coerente com a tarefa)
- Qualidade da imagem (foco, iluminação, ângulo)
- Sinais de manipulação ou atalho (ex: foto de foto na tela)

**OCR (quando aplicável):**
- Títulos de livros, documentos, telas de exercícios
- Números de página, timestamps, nomes de arquivos
- Texto em quadros brancos, anotações, listas

**Cruzamento com histórico:**
- Padrões de evidência que foram aceitos antes para tarefas similares
- Padrões que foram rejeitados (aprende o que não é suficiente)
- Calibração do threshold de confiança por categoria de tarefa

---

## 3. Output do Agente

```json
{
  "aprovado": true,
  "confianca": 87,
  "mensagem": "Livro aberto identificado na página 143. Boa progressão!",
  "ocr_detectado": "Capítulo 8 — página 143",
  "objetos_detectados": ["livro aberto", "marcador de página", "mesa de trabalho"],
  "notas_aprendizado": "Livros com título legível na capa aumentam confiança. Marcador visível é sinal positivo.",
  "motivo_rejeicao": null
}
```

**Campos:**

| Campo | Tipo | Descrição |
|---|---|---|
| `aprovado` | bool | Decisão final |
| `confianca` | 0–100 | Score de certeza do agente |
| `mensagem` | string | Feedback curto ao usuário (motivacional se aprovado, orientativo se reprovado) |
| `ocr_detectado` | string | Texto extraído da imagem, se relevante |
| `objetos_detectados` | string[] | Lista de itens identificados na cena |
| `notas_aprendizado` | string | Observação para alimentar o histórico futuro |
| `motivo_rejeicao` | string\|null | Se reprovado, explica o motivo sem ser punitivo |

---

## 4. System Prompt do Agente

O system prompt define o comportamento base. Deve ser versionado e testado como código.

```
Você é o verificador de tarefas do FocusLock. Seu papel é analisar imagens 
como evidência de conclusão de tarefas do mundo real.

PRINCÍPIOS DE JULGAMENTO:
- Seja generoso, não punitivo. A pessoa fez esforço de sair do celular e realizar algo.
- Exija evidência razoável, não perfeita. Uma foto escura de um livro aberto 
  ainda é evidência.
- Detecte atalhos óbvios: foto de foto na tela, imagem baixada da internet, 
  cena claramente encenada sem esforço real.
- Use o histórico fornecido para calibrar seu threshold. Se o usuário sempre 
  envia fotos de determinado tipo e eram aprovadas, mantenha consistência.

THRESHOLDS POR CATEGORIA:
- Estudo/leitura: exige livro/material visível. OCR de título ou página aumenta confiança.
- Exercício físico: ambiente de treino, roupa adequada, equipamento ou suor visível.
- Trabalho/documentos: documento, notebook ou área de trabalho organizada.
- Família: contexto doméstico e presença de pessoas ou itens pessoais — não exija faces.
- Casa/organização: ambiente antes/depois não é necessário; estado organizado é suficiente.

RETORNE APENAS JSON. Sem markdown, sem texto fora do JSON.
```

---

## 5. Estratégia de Aprendizado Adaptativo

### 5.1 Como o agente aprende (sem fine-tuning)

O agente não é re-treinado — ele aprende via **contexto acumulado** injetado em cada requisição. Isso é possível graças à janela de contexto longa dos modelos de visão atuais.

```
Requisição N:   sem histórico              → confiança base do modelo
Requisição 10:  9 verificações no contexto → começa a calibrar padrões
Requisição 30:  29 verificações            → alta precisão personalizada
Requisição 50+: histórico rolling (50)     → comportamento estável e personalizado
```

### 5.2 O que é armazenado para aprendizado

**Armazenado localmente (no device):**
- Tarefa verificada
- Decisão (aprovado/reprovado)
- Score de confiança
- Objetos detectados
- Notas de aprendizado geradas pelo próprio agente
- Hash da imagem (sem a imagem em si)

**Nunca armazenado:**
- A imagem em si
- Dados biométricos
- Informações pessoais além da tarefa

### 5.3 Histórico rolling

Limite de 50 verificações no contexto (por performance e custo de tokens). As mais recentes têm mais peso — implementar com slice das últimas 50, ordenadas por timestamp decrescente.

### 5.4 Aprendizado entre categorias

O agente deve receber histórico filtrado por categoria quando possível. Verificações de "exercício" não deveriam poluir o contexto para calibrar "leitura".

```javascript
// Filtrar histórico relevante antes de injetar no prompt
const historicoRelevante = historico
  .filter(h => h.categoria === tarefaAtual.categoria)
  .slice(0, 20)
  .concat(
    historico.filter(h => h.categoria !== tarefaAtual.categoria).slice(0, 10)
  );
```

---

## 6. Casos de Borda e Como Tratar

| Caso | Tratamento |
|---|---|
| Foto completamente preta / sem conteúdo | Rejeitar com "Foto muito escura. Tente em melhor iluminação." |
| Foto de outra foto na tela do celular | Detectar reflexo de tela ou bordas de dispositivo → rejeitar |
| Tarefa vaga ("fazer algo importante") | Confiança base reduzida — pedir evidência mais específica no onboarding da tarefa |
| Primeira tarefa do usuário (sem histórico) | Usar apenas contexto da tarefa + system prompt padrão |
| Timeout da API | Manter bloqueio + notificar usuário para tentar novamente |
| Modo avião / sem internet | Fila local — verificar quando conectar. Manter bloqueio enquanto isso |
| Múltiplas tentativas reprovadas (3+) | Oferecer sugestão alternativa de evidência ("Talvez uma foto mais próxima?") |

---

## 7. Roadmap do Agente

### Fase 1 — MVP
- Verificação via Claude Vision API (Anthropic)
- Histórico local injetado no contexto
- System prompt versionado

### Fase 2 — Melhoria de precisão
- A/B test de variações do system prompt
- Métricas de aprovação por categoria para detectar thresholds muito altos ou baixos
- Feedback explícito do usuário ("a IA errou aqui") para identificar gaps

### Fase 3 — Fine-tuning (futuro)
- Coletar dataset anonimizado de pares (imagem_hash + decisão + feedback)
- Fine-tuning de modelo menor e mais barato para verificações offline
- Modelo local no device para casos sem internet

### Fase 4 — Visão multimodal expandida
- Análise de sequência de frames (prova de processo, não só resultado)
- Detecção de contexto temporal (hora do dia coerente com a tarefa)
- Reconhecimento de ambiente recorrente (usuário treina sempre na mesma academia)

---

## 8. Custo estimado por verificação

| Modelo | Custo estimado por verificação | Observação |
|---|---|---|
| Claude Sonnet (Vision) | ~$0.003–0.008 | Depende do tamanho da imagem e histórico |
| GPT-4o Vision | ~$0.005–0.012 | Alternativa equivalente |
| Modelo local (Fase 3) | $0.00 | Após fine-tuning |

Com 5 verificações/dia por usuário: ~$0.015–0.04/usuário/dia. Viável com plano premium de ~$4–8/mês.
