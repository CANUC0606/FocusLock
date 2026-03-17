# CONTRIBUTING.md — FocusLock

Obrigado por querer contribuir. Este guia explica como o projeto funciona e como ajudar.

---

## Antes de começar

Leia os documentos principais:
- [TECHNICAL.md](./TECHNICAL.md) — arquitetura e decisões técnicas
- [AI_AGENT.md](./AI_AGENT.md) — especificação do agente de IA
- [ROADMAP.md](./ROADMAP.md) — o que está planejado e o que NÃO construir

---

## Como contribuir

### Reportar bugs
Abra uma issue com:
- Versão do app e SO
- Passos para reproduzir
- Comportamento esperado vs. observado
- Screenshot se relevante

### Sugerir funcionalidades
Abra uma issue com label `enhancement`. Descreva o problema que a funcionalidade resolve, não apenas a solução.

### Contribuir com código
1. Fork o repositório
2. Crie uma branch: `git checkout -b feat/nome-da-feature`
3. Faça commits pequenos e descritivos
4. Abra um Pull Request contra `main`
5. Descreva o que mudou e por quê

---

## Princípios que guiam decisões de código

**1. A fricção é intencional**  
Não simplifique demais o desbloqueio. A dificuldade de burlar é a funcionalidade, não um bug.

**2. Privacidade por padrão**  
Dados do usuário ficam no device. Qualquer sync para servidor é opt-in explícito. Imagens nunca são armazenadas.

**3. O agente de IA é generoso, não punitivo**  
Ao modificar prompts ou lógica de verificação, mantenha o tom de apoio. O app está do lado do usuário.

**4. Zero terminologia clínica no produto**  
O app não diagnostica, não trata, não menciona condições médicas. É uma ferramenta de produtividade e presença.

---

## Setup de desenvolvimento

```bash
# Clonar
git clone https://github.com/seu-usuario/focuslock.git
cd focuslock

# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Adicionar sua ANTHROPIC_API_KEY no .env

# Rodar (web/protótipo)
npm run web

# Rodar no Android (requer Android Studio)
npm run android
```

---

## Variáveis de ambiente

```env
ANTHROPIC_API_KEY=sk-ant-...
# Nunca commitar a chave real. Use .env.local para desenvolvimento.
```

---

## Estrutura de pastas (planejada)

```
focuslock/
├── src/
│   ├── screens/          # Telas do app
│   ├── components/       # Componentes reutilizáveis
│   ├── hooks/            # Hooks customizados
│   ├── lib/
│   │   ├── claude.js     # Integração com IA
│   │   ├── storage.js    # Persistência local
│   │   └── scheduler.js  # Agendamento de tarefas
│   └── constants/        # Prompts, categorias, configurações
├── docs/                 # Documentos do projeto
└── .env.example
```

---

## Dúvidas

Abra uma issue com label `question`.
