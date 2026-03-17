# ROADMAP.md — FocusLock

## Fases de desenvolvimento, prioridades e decisões estratégicas

---

## Visão de longo prazo

Tornar o FocusLock a ferramenta de referência para pessoas que querem usar o smartphone de forma intencional — não com culpa, mas com controle real.

---

## Fase 0 — Fundação (atual)

**Objetivo:** Validar a premissa central antes de investir em mobile nativo.

| Item | Status |
|---|---|
| Protótipo web funcional (React) | ✅ Feito |
| Fluxo completo com IA real (verificação por foto) | ✅ Feito |
| Onboarding comportamental com análise de perfil | ✅ Feito |
| Sistema de emergência oculto | ✅ Feito |
| Código de confiança (pessoa de confiança define) | ✅ Feito |
| Memória persistente e aprendizado adaptativo | ✅ Feito |
| Documento técnico para devs | ✅ Feito |

---

## Fase 1 — MVP Mobile (Android primeiro)

**Objetivo:** App funcional no Android com bloqueio real de tela.

**Duração estimada:** 8–12 semanas com 1 dev mobile experiente

### Must-have
- [ ] App React Native com Expo (ou bare RN)
- [ ] Bloqueio real via `DevicePolicyManager` (Android Device Admin)
- [ ] `AlarmManager` com `setExactAndAllowWhileIdle` para disparos precisos
- [ ] Câmera nativa com `expo-camera` ou `react-native-vision-camera`
- [ ] Integração com Claude Vision API para verificação
- [ ] Persistência local com `expo-sqlite`
- [ ] Histórico de verificações (aprendizado adaptativo)
- [ ] Sistema de emergência (7 toques + código criptografado)
- [ ] Onboarding completo com análise de perfil

### Nice-to-have Fase 1
- [ ] Notificações push de lembrete antes do horário
- [ ] Widget de status na home screen
- [ ] Modo recorrência (tarefa diária, dias úteis)

### Fora do escopo Fase 1
- iOS (limitações técnicas — ver abaixo)
- Sync entre dispositivos
- Conta de usuário / login
- Monetização

---

## Fase 2 — Polimento e iOS

**Objetivo:** Experiência refinada, iOS com melhor abordagem possível.

### Android
- [ ] Foreground service para monitoramento contínuo
- [ ] Detecção de desinstalação (exigir código de confiança para remover)
- [ ] Suporte a múltiplas tarefas no mesmo dia
- [ ] Relatórios semanais de desempenho

### iOS
- [ ] Screen Time API + `ManagedSettings` (iOS 16+)
- [ ] `DeviceActivityMonitor` para alertas de uso excessivo
- [ ] Overlay fullscreen com câmera como fallback (não é bloqueio nativo, mas cria fricção real)
- [ ] Investigar MDM enrollment voluntário para bloqueio mais profundo

### Agente de IA
- [ ] A/B test de variações do system prompt
- [ ] Feedback explícito do usuário sobre erros do agente
- [ ] Métricas de precisão por categoria

---

## Fase 3 — Crescimento

**Objetivo:** Monetização sustentável e expansão do produto.

- [ ] Conta de usuário + sync (opcional, opt-in)
- [ ] Plano gratuito (X verificações/mês) + plano premium ilimitado
- [ ] Modo família: adulto define tarefas e código para outros membros da família
- [ ] Integração com calendário (importar compromissos como tarefas)
- [ ] Estatísticas avançadas de comportamento ao longo do tempo

---

## Fase 4 — IA avançada

- [ ] Fine-tuning de modelo próprio com dataset anonimizado
- [ ] Verificação offline (modelo local no device)
- [ ] Análise de sequência (prova de processo, não só resultado final)
- [ ] Detecção de ambiente recorrente (usuário treina sempre no mesmo lugar)

---

## Decisões estratégicas

### Por que Android primeiro?
iOS tem restrições severas para bloqueio real de tela — exigiria MDM corporativo. Android via Device Policy Manager permite bloqueio nativo com instalação voluntária do usuário. Android também tem maior penetração nos mercados onde o produto tem mais potencial inicial.

### Por que não construir o OCR do zero?
O OCR proprietário exigiria dataset extenso, tempo de treinamento e manutenção. Modelos de visão de grande escala (Claude, GPT-4o) já têm OCR de alta qualidade embutido e melhoram continuamente. O diferencial do produto não está no OCR — está na lógica de verificação e no design de comportamento.

### Por que não monetizar com ads?
O produto existe para reduzir o uso de tela. Ads criam incentivo perverso para engajamento. Monetização via assinatura alinha os incentivos: o produto ganha quando o usuário tem sucesso.

### Por que o código de emergência não pode ser recuperado pelo usuário?
Esse é o mecanismo central de anti-burla. Se o usuário pode recuperar o código, a fricção desaparece. A proposta de valor inteira está na impossibilidade de burlar facilmente. Usuários que realmente precisam precisam chamar a pessoa de confiança — o que, em si, já cria accountability social.

---

## O que NÃO construir (para sempre)

- **Diagnóstico ou terminologia clínica no produto** — o app não diagnostica nada, não menciona condições médicas, não sugere tratamentos
- **Gamificação punitiva** — sem pontuações que envergonham, sem ranking público de "quem falhou mais"
- **Armazenamento de imagens dos usuários** — zero, jamais
- **Modo parental coercitivo** — o app é sempre opt-in do próprio usuário
- **Ads de qualquer tipo** — incompatível com a proposta

---

## Stack recomendada

```
react-native (com Expo SDK 51+)
  ├── expo-camera          # captura de imagens
  ├── expo-sqlite          # persistência local
  ├── expo-notifications   # lembretes
  ├── expo-background-task # scheduler
  └── react-native-device-policy (Android)  # bloqueio real

Backend (Fase 2+)
  ├── Supabase             # auth + storage opcional
  └── Edge Functions       # proxy para API de IA (proteger chave)

IA
  └── Anthropic Claude Vision API (claude-sonnet-*-vision)
```
