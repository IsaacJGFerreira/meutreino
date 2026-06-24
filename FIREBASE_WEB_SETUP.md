# Configurar Firebase na versão web

Este guia mostra como ligar a versão web do MeuTreino ao Firebase usado pelo app.

## 1. Copiar a configuração Web no Firebase

No Firebase Console:

1. Abra o projeto do MeuTreino.
2. Entre em **Configurações do projeto**.
3. Na aba **Geral**, vá até **Seus apps**.
4. Se ainda não existir um app Web, clique no ícone `</>` e registre um app.
5. Copie os campos do objeto `firebaseConfig`.

O objeto do Firebase vem neste formato:

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "...",
  measurementId: "..."
};
```

## 2. Criar os secrets no GitHub

No repositório, entre em:

**Settings > Secrets and variables > Actions > New repository secret**

Cadastre um secret para cada campo:

| Secret no GitHub | Campo do Firebase |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `VITE_FIREBASE_APP_ID` | `appId` |
| `VITE_FIREBASE_MEASUREMENT_ID` | `measurementId` |

O `measurementId` é opcional. Se ele não for usado, a versão web continua funcionando com Auth, Firestore e Storage.

## 3. Ativar o GitHub Pages

Em **Settings > Pages**, selecione **GitHub Actions** como fonte de publicação.

## 4. Publicar

Depois de salvar os secrets, execute o workflow:

**Actions > Deploy web desktop > Run workflow**

Quando o deploy terminar, a versão web deve abrir em:

```text
https://isaacjgferreira.github.io/meutreino/
```

## Observação de segurança

Não coloque os valores reais do Firebase em arquivos versionados do repositório. Use os secrets do GitHub Actions. Mesmo que a configuração Web do Firebase seja usada no navegador, as regras do Firebase continuam sendo a parte principal da segurança do app.
