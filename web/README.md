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
