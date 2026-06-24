# Checklist da versão web

Use quando o site abre, mas não entra na conta e também não cria uma nova conta.

## O que o código faz

A versão web usa o mesmo fluxo principal do app Android:

1. Login com email e senha pelo Firebase Auth.
2. Criação de conta pelo Firebase Auth.
3. Criação do perfil em users/{uid} no Firestore.

Se a tela fica parada no login, confira primeiro o painel do Firebase.

## Passo 1: ativar Email/Password

No Firebase Console:

1. Clique em Authentication.
2. Clique em Sign-in method.
3. Clique em Email/Password.
4. Ative a opção.
5. Clique em Save.

## Passo 2: autorizar o domínio do site

No Firebase Console:

1. Clique em Authentication.
2. Clique em Settings.
3. Procure Authorized domains.
4. Clique em Add domain.
5. Adicione o domínio do GitHub Pages.

Use somente o domínio, sem https e sem o caminho do projeto.

## Passo 3: conferir a chave web

No Firebase Console:

1. Clique na engrenagem do projeto.
2. Clique em Project settings.
3. Na aba General, confira o app Web.
4. Confirme se os dados são do mesmo projeto usado no app Android.

## Passo 4: conferir restrição da API key

Se a API key estiver restrita só para Android, a versão web pode não conseguir fazer login.

No Google Cloud Console:

1. Clique em APIs and Services.
2. Clique em Credentials.
3. Abra a API key usada pelo Firebase.
4. Em Application restrictions, permita uso por HTTP referrers ou remova a restrição temporariamente para testar.

## Passo 5: publicar de novo

Depois de qualquer ajuste:

1. Volte ao GitHub.
2. Clique em Actions.
3. Clique em Deploy web desktop.
4. Clique em Run workflow.
5. Espere ficar verde.

## Resultado esperado

Depois de criar conta, o site deve sair da tela de login e ir para a tela de liberação por código.
