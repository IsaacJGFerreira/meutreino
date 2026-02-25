# MeuTreino Web

Projeto web (React + Vite + TypeScript) do sistema MeuTreino.

## Pré-requisitos

- Node.js 20+
- npm 10+

## Configuração do Firebase (Web SDK)

1. Copie o arquivo de exemplo:

```bash
cp .env.example .env
```

2. Abra o arquivo `.env` e preencha com as credenciais do projeto Firebase Web:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

> Se as variáveis não estiverem configuradas, o app não inicializa os serviços Firebase e exibe a mensagem **"Firebase env not configured"** no console e na interface.

## Executar em desenvolvimento

```bash
npm install
npm run dev
```

## Build de produção

```bash
npm run build
npm run preview
```

## PWA

A aplicação está preparada como PWA usando `vite-plugin-pwa`, com:

- Manifest Web App gerado no build.
- Service Worker com atualização automática (`registerType: autoUpdate`).
- Ícones placeholder em `public/icons/`.

Após rodar `npm run build`, os artefatos de PWA são gerados em `dist/`.

## Deploy no Firebase Hosting (passo a passo)

> Os passos abaixo **não executam login por você**; servem apenas de documentação/configuração local.

1. Instale dependências e gere o build:

```bash
npm install
npm run build
```

2. Inicialize o Firebase Hosting (na pasta `web/`):

```bash
firebase init hosting
```

Escolha/garanta as opções:

- `public directory`: `dist`
- `single-page app (rewrite all urls to /index.html)`: `Yes`
- `set up automatic builds and deploys with GitHub`: `No` (opcional)

3. (Opcional) Use os arquivos já preparados neste projeto:

- `firebase.json` (hosting com rewrite para SPA)
- `.firebaserc.example` (modelo; copie para `.firebaserc` e ajuste seu `projectId`)

4. Faça deploy:

```bash
firebase deploy --only hosting
```

Se preferir definir projeto via CLI antes do deploy:

```bash
firebase use --add
```
