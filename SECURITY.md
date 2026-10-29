# Segurança — Rodízio de Almoço (scadahub)

Estado em 29/10/2026. Login e papéis estão detalhados em [AUTHENTICATION.md](AUTHENTICATION.md).

## 1. Onde fica a segurança

O app é um site estático (GitHub Pages) que fala direto com o Firebase. Tudo que roda no navegador pode ser alterado por quem usa, então **a única barreira real são as regras do Realtime Database** (`database.rules.json`). As checagens de papel na tela (`canUserEditSlot` e afins) só escondem botões.

```text
Navegador (não confiável)
  │  login Google @daqhmi.com / @scadahub.io (Firebase Authentication)
  ▼
Token do Firebase (uid, e-mail, email_verified)
  │
  ▼
Regras do Realtime Database  ←  decidem toda leitura e gravação
```

A Web API Key do Firebase está no código e isso é esperado: ela identifica o projeto, não dá acesso. Quem dá acesso são o token do usuário e as regras.

## 2. Regras do banco

| Caminho | Leitura | Escrita |
|---|---|---|
| raiz e qualquer caminho não listado | ninguém | ninguém |
| `scadahub_admins/{uid}` | só o próprio uid | ninguém pelo app (console do Firebase) |
| `scadahub_employees` | conta da empresa com e-mail verificado | admin; o colaborador edita o próprio cadastro sem mudar e-mail nem cargo, e não cria nem exclui |
| `scadahub_schedules/{data}/{horário}` | conta da empresa com e-mail verificado | admin; o colaborador grava, move e apaga só o horário cujo `employeeId` tem o e-mail dele |
| `scadahub_settings`, `scadahub_history` | conta da empresa com e-mail verificado | admin |

* **Conta da empresa** = `auth.token.email` terminando em `@daqhmi.com` (domínio do Google Workspace) ou `@scadahub.io` (domínio secundário do mesmo Workspace), com `email_verified`.
* **Dono do horário** = o colaborador de `scadahub_employees/{employeeId}` cujo `email` (em minúsculas) é o e-mail do token. Por isso a equipe é gravada com a chave igual ao `id`, e o e-mail cadastrado é o de login Google.
* **Admin** = `scadahub_admins/{uid} === true`, gravado só pelo console.
* Todo horário precisa ter `employeeId`, `startTime` e `endTime`.

## 3. Como é testado

* `tests/database.rules.test.js` roda o `database.rules.json` de verdade no emulador do Realtime Database (projeto `demo-rodizio`, sem contato com a produção). Cobre: sem login, Gmail, domínio parecido (`@daqhmi.com.evil.com`), e-mail não verificado, colaborador no próprio horário e no dos outros, troca de dono, cadastro próprio, autopromoção a admin, configurações e histórico, e o admin.
* `tests/rbac_security.test.js` checa a estrutura do arquivo de regras (nenhuma permissão fixa em `true`, toda leitura exige conta da empresa) e trava senhas fixas no código (`shubadm`, `Admin@123456` e outras não podem voltar a `src/`).
* `tests/firebase_sync.test.js` testa o transporte (WebSocket e contingência HTTPS) num namespace isolado do emulador.
* `npm test` sobe o emulador (precisa de Java 21) e roda tudo. O deploy do GitHub Pages roda os mesmos testes antes de publicar.
* Publicar as regras: `npx firebase deploy --only database --project rodizio-almoco-equipe`. Depois, conferir que `curl https://rodizio-almoco-equipe-default-rtdb.firebaseio.com/.json` responde `Permission denied`.

## 4. Controles no navegador

* CSP em `<meta>` no `index.html`: scripts só do próprio site, do Firebase e de `apis.google.com` (janela de login do Google); conexões só com Firebase e Google.
* `X-Content-Type-Options: nosniff` e `Referrer-Policy: strict-origin-when-cross-origin` também em `<meta>`.
* **Limitação conhecida:** `frame-ancestors` não funciona em `<meta>`, e o GitHub Pages não permite cabeçalhos HTTP próprios. Não há proteção efetiva contra o site ser embutido em outra página (clickjacking). O risco é baixo porque toda ação exige login, mas só se resolve hospedando onde se controlem cabeçalhos (ex.: Firebase Hosting).
* Ao abrir, o app apaga do `localStorage` as chaves do login antigo (sessão local, senhas e diretório de contas).

## 5. Projeto Firebase

* Projeto `rodizio-almoco-equipe`, plano Blaze. Sem login, o banco não aceita leitura nem gravação, o que fecha o caminho de gravações em volume gerando cobrança. Alerta de orçamento: pendente.
* Provedores de login: só Google. Domínios autorizados: `localhost`, os domínios do próprio projeto e `mateusg0m3s.github.io`.
* Proprietários do projeto: hoje uma conta pessoal; recomendado adicionar uma conta `@daqhmi.com`.
* Backups: o plano não faz backup automático do Realtime Database. Exportar com `npx firebase database:get / --project rodizio-almoco-equipe` e guardar fora do repositório (que é público).

## 6. Histórico

* **Até 29/10/2026:** `scadahub_employees`, `scadahub_schedules`, `scadahub_settings` e `scadahub_history` aceitavam leitura e gravação sem login, e o login tinha um caminho no navegador com senhas fixas no código. Os relatórios de auditoria e pentest da época (`SECURITY_AUDIT.md`, `PENETRATION_TEST.md`, `SECURITY_FIXES.md`, `FIREBASE_SECURITY.md`, `ARCHITECTURE_SECURITY.md`) validavam um simulador escrito à mão em vez das regras reais e foram substituídos por este documento; continuam no histórico do git.
* **29/10/2026 (PRs #9 e #10):** login só com Google da empresa, regras por conta, testes das regras no emulador, testes sem tocar a produção, deploy condicionado aos testes.
