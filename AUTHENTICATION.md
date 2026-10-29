# Autenticação e autorização — Rodízio de Almoço (scadahub)

## 1. Como funciona

* **Login:** só com a conta Google da empresa, pela janela do Google (`signInWithPopup`). Não existe senha do app para criar, trocar ou esquecer. O Workspace é `daqhmi.com`, então o login sai com o e-mail `@daqhmi.com`; `@scadahub.io` é domínio secundário do mesmo Workspace e também é aceito.
* **Quem barra:** as regras do Realtime Database (`database.rules.json`). A tela também recusa outro domínio, mas isso é só conveniência: sem login verificado `@daqhmi.com` ou `@scadahub.io`, o banco não responde.
* **Sessão:** a do Firebase Authentication, que continua ao recarregar a página. O app só assina o banco depois do login.

```text
[Entrar com Google] → popup do Google (hd=daqhmi.com)
        │
        ▼
onAuthStateChanged
        ├── e-mail não verificado ou fora de @daqhmi.com / @scadahub.io → signOut
        ├── /scadahub_admins/{uid} === true → papel admin
        └── colaborador = item de /scadahub_employees com o mesmo e-mail
```

## 2. Regras do banco

| Caminho | Leitura | Escrita |
|---|---|---|
| `scadahub_employees` | conta da empresa verificada | admin; o colaborador edita o próprio cadastro, sem mudar e-mail nem cargo |
| `scadahub_schedules/{data}/{slot}` | conta da empresa verificada | admin; o colaborador grava, move e apaga só o horário cujo `employeeId` tem o e-mail dele |
| `scadahub_settings`, `scadahub_history` | conta da empresa verificada | admin |
| `scadahub_admins/{uid}` | só o próprio uid | ninguém pelo app (console do Firebase) |
| qualquer outro caminho | ninguém | ninguém |

A ligação conta ↔ colaborador é o **e-mail cadastrado na aba Equipe**. Quem entra com um e-mail que não está na equipe vê a escala, mas não grava nada, e o app avisa.

## 3. Primeiro administrador

1. A pessoa entra uma vez no site com a conta Google.
2. No console do Firebase → Authentication → Usuários, copie o **UID** dela.
3. No Realtime Database, crie `scadahub_admins/<UID>` com o valor `true` (ou: `npx firebase database:update /scadahub_admins '{"<UID>": true}' --project rodizio-almoco-equipe`).
4. Ela sai e entra de novo; o papel é lido no login.

## 4. Novo colaborador

O admin cadastra na aba Equipe com o e-mail de login Google da pessoa (o `@daqhmi.com`, não o alias `@scadahub.io`). No primeiro login com Google, a conta já cai no colaborador certo. Para tirar o acesso de gravação, apague ou troque o e-mail no cadastro; para bloquear a conta inteira, desative o usuário no console do Firebase.

## 5. Configuração no console do Firebase

* Authentication → Método de login: **Google** ativado.
* Authentication → Configurações → Domínios autorizados: `mateusg0m3s.github.io` (e `localhost` para desenvolvimento).
* Depois que todos migrarem, desative o provedor **E-mail/senha**: nenhuma tela usa mais.

## 6. Testes e desenvolvimento local

* `npm test` sobe o emulador do Realtime Database (projeto `demo-rodizio`, nunca a produção) e roda todas as suítes, incluindo `tests/database.rules.test.js`, que testa o `database.rules.json` de verdade. Precisa de Java 21.
* `npm run dev:emulators` abre o app contra os emuladores de Auth e Database. A janela do Google vira o seletor de contas falsas do emulador, e o banco começa vazio.
* Publicar as regras: `npx firebase deploy --only database --project rodizio-almoco-equipe`.
