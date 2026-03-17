# FocusLock Mobile (Expo)

App mobile-first para teste real no celular com Expo Go, conectado ao backend Next.js + Anthropic.

## Requisitos

- Conta Expo (gratuita)
- App Expo Go no celular
- Backend do projeto em execucao (local, Codespace ou deploy)
- Node.js 20+

## Configuracao obrigatoria

1. No backend (raiz do projeto), configure a chave da Anthropic:

```bash
cp .env.example .env.local
```

Preencha pelo menos:

```bash
ANTHROPIC_API_KEY=sk-ant-...
```

Se voce estiver no Codespaces mobile e nao conseguir editar `.env.local`, use um secret do Codespaces no GitHub com o nome `ANTHROPIC_API_KEY`.

Fluxo recomendado no celular:

1. Abra o repositorio no GitHub.
2. Entre em Settings.
3. Abra Secrets and variables.
4. Abra Codespaces.
5. Crie um secret chamado `ANTHROPIC_API_KEY`.
6. Cole a chave ali e salve.
7. Reinicie o servidor Next.js depois disso.

Com esse secret, o backend ja consegue ler `process.env.ANTHROPIC_API_KEY` sem depender do arquivo `.env.local`.

2. No mobile, configure a URL base da API:

```bash
cd mobile
cp .env.example .env
```

`mobile/.env`:

```bash
EXPO_PUBLIC_API_BASE_URL=https://seu-backend.com
```

Exemplo em dev local na mesma rede Wi-Fi:

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.0.15:3000
```

## Rodando backend + mobile

Terminal 1 (backend):

```bash
npm install
npm run dev
```

Terminal 2 (mobile):

```bash
cd mobile
npm install
npm run start
```

Depois escaneie o QR no Expo Go.

## Escopo atual

- Onboarding comportamental (6 perguntas)
- Onboarding com API (`/api/onboarding`) e fallback local
- Criacao de tarefas com categoria + evidencia esperada
- Fluxo de bloqueio por horario/simulacao
- Captura de camera
- Verificacao real por IA (`/api/verify`) com Anthropic Vision
- Historico local das verificacoes (rolling 50)
- Desbloqueio de emergencia oculto (7 toques)

## Observacoes importantes

- Sem `EXPO_PUBLIC_API_BASE_URL`, o app nao consegue validar tarefa na IA.
- A chave da Anthropic fica apenas no backend.
- Para Expo Go no celular, nao use `localhost` na URL da API; use IP de rede ou URL publica.
