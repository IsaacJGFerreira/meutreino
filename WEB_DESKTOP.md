# MeuTreino para computador

Este repositório agora tem uma versão web/PWA em `web-desktop`. Ela mantém o app Android original e adiciona uma interface para computador que usa as mesmas coleções do Firebase:

- `users/{uid}`
- `users/{uid}/treinos`
- `users/{uid}/treino_registros`
- `users/{uid}/progresso`
- `users/{uid}/cardio`
- `users/{uid}/notifications`
- `invites`
- `invite_requests`
- `trainers/{trainerUid}/students`

## Rodar localmente

```bash
cd web-desktop
npm install
npm run dev
```

## Configuração Firebase

A versão web aceita a configuração do Firebase de duas formas:

1. Pela tela inicial de configuração, salva somente no navegador usado.
2. Por variáveis no build:

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

No GitHub Pages, coloque esses valores em `Settings > Secrets and variables > Actions`.

## Publicação

O workflow `.github/workflows/deploy-web-desktop.yml` publica o conteúdo de `web-desktop/dist` no GitHub Pages quando houver push na branch `origin`.

URL esperada depois do primeiro deploy:

```text
https://isaacjgferreira.github.io/meutreino/
```

Se o Pages ainda não estiver ligado no repositório, ative em `Settings > Pages` e selecione `GitHub Actions`.
