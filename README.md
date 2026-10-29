# Rodízio de Almoço (scadahub)

Escala de almoço e atendimento da equipe: cada pessoa lança o próprio horário, o admin gera o rodízio, e o painel mostra quem está no posto durante a janela crítica.

Site: https://mateusg0m3s.github.io/RodizioAlmoco/

## Stack

React 19 + Vite 8 (JS/JSX), CSS com tokens, lucide-react, Firebase 12 (Authentication com Google e Realtime Database), oxlint, testes com `node --test`.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | App local contra o Firebase de produção |
| `npm run dev:emulators` | App local contra os emuladores de Auth e Database (projeto `demo-rodizio`, banco vazio; a janela do Google vira o seletor de contas falsas do emulador) |
| `npm test` | Sobe o emulador do Realtime Database e roda todas as suítes, incluindo as regras do banco. Precisa de Java 21 |
| `npm run build` | Build de produção em `dist/` |
| `npm run lint` | oxlint |

## Publicação

* **Site:** merge na `main` → GitHub Actions roda `npm test`, faz o build e publica no GitHub Pages. Se um teste falhar, nada é publicado.
* **Regras do banco:** `npx firebase deploy --only database --project rodizio-almoco-equipe` (não é automático).
* As variáveis `VITE_FIREBASE_*` do build ficam nos secrets do repositório; `.env.example` mostra os nomes.

## Documentação

* [AUTHENTICATION.md](AUTHENTICATION.md): login, papéis, primeiro admin, novo colaborador.
* [SECURITY.md](SECURITY.md): onde fica a segurança, regras do banco, testes, limitações e histórico.

## Estrutura

```text
src/
  components/   telas e componentes (LoginScreen, DashboardView, TimelineView, TeamView…)
  services/     authService (login e papéis), firebaseService (banco, contingência HTTPS), storage, som
  utils/        escala e cobertura (scheduler), horários, nomes, cores
  styles/       tokens e componentes do design system
tests/          suítes node --test (regras no emulador em database.rules.test.js)
tools/          with-emulators.mjs: roda um comando com os emuladores do Firebase
```
