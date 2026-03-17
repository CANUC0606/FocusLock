# TECHNICAL.md — FocusLock

## Documento Técnico de Produto e Engenharia

**Versão:** 1.0  
**Status:** Pre-desenvolvimento  
**Audiência:** Desenvolvedores, tech leads, colaboradores

---

## 1. Visão Geral

FocusLock é um aplicativo mobile que bloqueia o acesso ao dispositivo e só libera após verificação visual por IA de que uma tarefa do mundo real foi concluída. O objetivo é criar uma camada de responsabilidade real — não apenas um lembrete ou timer, mas uma consequência concreta para o uso compulsivo do smartphone.

O produto é **generalista**: serve para qualquer pessoa que queira reduzir o tempo de tela não intencional e ser mais presente — no trabalho, nos estudos, em casa, com a família.

---

## 2. Problema Central

### O que existe hoje

| App | Mecanismo | Ponto fraco |
|---|---|---|
| Screen Time (iOS/Android) | Timer e limites por app | Facilmente ignorado ou desativado |
| Forest | Gamificação (árvore morre se sair) | Sem verificação real da tarefa |
| Freedom | Bloqueio por tempo | Nenhuma prova de conclusão exigida |
| Streaks / Habitica | Hábitos e gamificação | Autodeclaração sem evidência |

**Nenhum exige prova física de que a tarefa foi feita.**

### O insight central

A diferença entre um compromisso que se cumpre e um que se abandona é, na maioria dos casos, a existência de **accountability externo**. FocusLock cria esse accountability de forma automatizada via IA.

---

## 3. Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────┐
│                     MOBILE APP                          │
│                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────┐ │
│  │  Onboarding  │───▶│   Dashboard  │───▶│  Bloqueio │ │
│  │  + Perfil    │    │   Tarefas    │    │  de tela  │ │
│  └──────────────┘    └──────────────┘    └─────┬─────┘ │
│                                                │        │
│                                         ┌──────▼──────┐ │
│                                         │   Câmera    │ │
│                                         │  (captura)  │ │
│                                         └──────┬──────┘ │
└────────────────────────────────────────────────┼────────┘
                                                 │
                                    ┌────────────▼────────────┐
                                    │     AGENTE DE IA        │
                                    │  Vision + OCR + Memória │
                                    │  (Claude Vision API)    │
                                    └────────────┬────────────┘
                                                 │
                              ┌──────────────────┼──────────────────┐
                              │                  │                  │
                    ┌─────────▼────┐   ┌─────────▼────┐   ┌────────▼────┐
                    │   Aprovado   │   │   Reprovado  │   │  Histórico  │
                    │  → Libera    │   │  → Mantém    │   │  → Aprende  │
                    │    tela      │   │   bloqueio   │   │             │
                    └─────────────┘   └──────────────┘   └─────────────┘
```

### 3.1 Componentes principais

**A. Módulo de Onboarding / Perfil**
- Coleta de dados comportamentais via questionário (6 dimensões: atenção, impulso, procrastinação, ritmo, relações, objetivo)
- Análise por IA gera perfil personalizado com estratégia recomendada
- Perfil salvo localmente e usado para personalizar thresholds de verificação

**B. Gerenciador de Tarefas**
- CRUD de tarefas com horário, categoria e descrição da evidência esperada
- Scheduler nativo (Android AlarmManager / iOS BackgroundTasks) para disparar o bloqueio
- Categorias: trabalho, estudo, exercício, família, casa

**C. Sistema de Bloqueio**
- Android: Device Policy Manager (DevicePolicyController) — bloqueio real de tela
- iOS: limitado; abordagem via Screen Time API + Guided Access + perfil MDM voluntário
- Fallback web/PWA: overlay fullscreen com captura de câmera integrada

**D. Agente de Verificação por IA**
- Recebe imagem capturada + contexto da tarefa + histórico de verificações anteriores
- Retorna: aprovado (bool), confiança (0–100), OCR detectado, notas de aprendizado
- Detalhado em AI_AGENT.md

**E. Sistema de Emergência (anti-burla)**
- Código definido por pessoa de confiança durante o setup — o usuário não sabe o código
- Acesso oculto: 7 toques rápidos em região neutra da tela de bloqueio
- Delay proposital de 3 segundos após inserção correta (dificulta impulso)
- Log de uso de emergência salvo localmente

---

## 4. Fluxo Completo do Usuário

```
PRIMEIRA VEZ
1. Welcome → Onboarding (6 perguntas) → Análise de perfil (IA)
2. Setup do código de confiança (outra pessoa digita)
3. Dashboard → Adicionar primeira tarefa

USO DIÁRIO
4. No horário definido → tela bloqueia automaticamente
5. Usuário realiza a tarefa no mundo real
6. Abre o app → captura foto como evidência
7. IA analisa → aprova ou reprova
8. Se aprovado: tela liberada + registro no histórico
9. Se reprovado: mantém bloqueio + sugere nova tentativa

EMERGÊNCIA REAL
10. 7 toques no canto superior direito → campo de código aparece
11. Pessoa de confiança insere o código (ou usuário liga para ela)
12. Tela liberada + log registrado
```

---

## 5. Modelo de Dados

### 5.1 Perfil do usuário
```json
{
  "tipo": "string",
  "subtitulo": "string",
  "nivel_impulsividade": "baixo|médio|alto",
  "pico_produtividade": "string",
  "estrategia": "string",
  "cor_tema": "#hex",
  "icone": "emoji",
  "blocos_sugeridos": ["string"],
  "criado_em": "ISO8601",
  "versao_onboarding": 1
}
```

### 5.2 Tarefa
```json
{
  "id": "uuid",
  "nome": "string",
  "descricao_evidencia": "string",
  "horario": "HH:MM",
  "categoria": "work|study|physical|family|home",
  "recorrencia": "none|daily|weekdays|custom",
  "status": "agendada|ativa|concluida|expirada",
  "criada_em": "ISO8601"
}
```

### 5.3 Verificação (histórico para aprendizado)
```json
{
  "id": "uuid",
  "tarefa_id": "uuid",
  "tarefa_nome": "string",
  "aprovado": true,
  "confianca": 87,
  "ocr_detectado": "string",
  "notas_aprendizado": "string",
  "imagem_hash": "sha256 (nunca a imagem em si)",
  "timestamp": "ISO8601"
}
```

### 5.4 Log de emergências
```json
{
  "id": "uuid",
  "tarefa_ativa": "string",
  "motivo_declarado": "string (opcional)",
  "timestamp": "ISO8601"
}
```

---

## 6. Segurança e Privacidade

### 6.1 Imagens
- **Imagens não são armazenadas permanentemente** — usadas apenas para a verificação em tempo real
- Apenas o hash SHA-256 da imagem é salvo no histórico (para deduplicação e auditoria local)
- Nunca enviadas para servidores próprios — tráfego direto ao provider de IA (Anthropic)

### 6.2 Código de confiança
- Armazenado com hashing bcrypt localmente (nunca em texto puro)
- Não recuperável pelo usuário — redefinição exige acesso físico da pessoa de confiança ao app

### 6.3 Dados do perfil comportamental
- Armazenados apenas localmente (AsyncStorage criptografado)
- Sync opcional com conta do usuário (opt-in explícito)
- Nunca usados para fins de diagnóstico clínico ou enviados a terceiros

---

## 7. Considerações por Plataforma

### Android
- `DevicePolicyManager` permite bloqueio real de tela via Device Admin
- `AlarmManager` com `setExactAndAllowWhileIdle` para disparos precisos
- Permissão `BIND_DEVICE_ADMIN` necessária — usuário instala voluntariamente
- Foreground Service para monitoramento contínuo

### iOS
- `Screen Time API` (iOS 16+) permite limites por app via `ManagedSettings`
- `DeviceActivityMonitor` para monitoramento de uso
- Limitação: bloqueio total de tela exige perfil MDM — complexo para consumer apps
- Estratégia MVP: overlay fullscreen + câmera integrada (não é bloqueio nativo, mas cria fricção real)
- Estratégia ideal: parceria ou uso de MDM enrollment voluntário

---

## 8. O que NÃO fazer

| Tentação | Por que evitar |
|---|---|
| Guardar fotos dos usuários | Risco de privacidade enorme, sem benefício real |
| Exibir diagnósticos médicos | Fora do escopo, cria responsabilidade legal |
| Tornar o desbloqueio fácil demais | Mata o produto — a fricção É a funcionalidade |
| Monetizar com ads | Contradiz o propósito do produto |
| Fazer o código de emergência recuperável pelo usuário | Destrói o mecanismo anti-burla |
| Criar pontuações públicas ou rankings | Pode criar competição negativa ou vergonha |

---

## 9. Dependências Externas

| Dependência | Uso | Alternativa |
|---|---|---|
| Anthropic Claude Vision API | Verificação de tarefas por imagem | GPT-4o Vision |
| Firebase / Supabase | Auth + sync opcional | Self-hosted Supabase |
| React Native | Framework mobile | Flutter |
| Expo | Build e distribuição simplificada | Bare RN |
| AsyncStorage | Persistência local | SQLite via expo-sqlite |

---

## 10. Métricas de sucesso (produto)

- **Taxa de conclusão de tarefas** — % de bloqueios que terminam em aprovação
- **Taxa de emergência** — % de sessões que usam desbloqueio de emergência
- **Melhora de precisão da IA** — confiança média por usuário ao longo do tempo
- **Retenção D7 / D30** — usuário ainda usando após 7 e 30 dias
- **Tempo médio entre bloqueio e aprovação** — proxy para tempo gasto na tarefa
