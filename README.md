# FocusLock

> **Bloqueio inteligente de tela com verificação por IA.**  
> O app que não libera o celular até você provar que fez o que prometeu.

---

## O problema

Apps de bloqueio existem. O problema é que todos têm uma coisa em comum: **a pessoa burla**.

Desinstala, ignora o timer, clica em "ignorar por hoje". O bloqueio não tem consequência real porque não existe verificação real.

FocusLock resolve isso com uma premissa simples: **a tela só abre quando uma IA confirma que a tarefa foi feita**.

---

## Como funciona

1. O usuário define uma tarefa e um horário
2. No horário, a tela bloqueia
3. O usuário realiza a tarefa no mundo real
4. Tira uma foto como evidência
5. A IA analisa a foto via visão computacional + OCR
6. Se aprovado: tela liberada. Se não: tente de novo

---

## Diferenciais

- **Verificação por evidência visual** — não basta prometer, precisa provar
- **IA que aprende** — cada verificação alimenta o histórico do usuário, melhorando a precisão ao longo do tempo
- **Código de confiança** — o desbloqueio de emergência é definido por outra pessoa (familiar, parceiro), não pelo próprio usuário
- **Emergência escondida** — o acesso ao desbloqueio de emergência é propositalmente difícil de encontrar (7 toques num ponto neutro)
- **Perfil comportamental** — onboarding baseado em fundamentos de neurociência comportamental, gera estratégias personalizadas

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend (MVP) | React Native |
| IA de verificação | Claude Vision API (Anthropic) |
| OCR | Integrado ao agente de visão |
| Storage local | AsyncStorage / SQLite |
| Auth / Sync | Firebase ou Supabase |
| Backend (futuro) | Node.js + Express |

---

## Status

`[ ] MVP em desenvolvimento`

## MVP Mobile Atual

O caminho principal de desenvolvimento agora esta em `mobile/` com Expo (React Native), pronto para teste em celular com Expo Go.

- Entrada do app: `mobile/App.js`
- Fluxo principal: `mobile/src/FocusLockMobileApp.js`
- Guia de execucao: `mobile/README.md`

Veja [ROADMAP.md](./ROADMAP.md) para o detalhamento completo.

---

## Documentos do projeto

| Arquivo | Conteúdo |
|---|---|
| [TECHNICAL.md](./TECHNICAL.md) | Documento técnico completo — arquitetura, agente de IA, segurança |
| [ROADMAP.md](./ROADMAP.md) | Fases de desenvolvimento, prioridades, O que NÃO fazer |
| [AI_AGENT.md](./AI_AGENT.md) | Especificação do agente de visão e OCR, treinamento, aprendizado |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Guia para contribuidores |

---

## Licença

MIT — uso livre, contribuições bem-vindas.
