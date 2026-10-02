# Relatório de Penetration Test — Rodízio de Almoço (scadahub)

**Data da Execução do Deploy e Testes Reais:** 01/10/2026 às 23:31:43 BRT  
**Alvo:** Sistema Rodízio de Almoço & Atendimento Contínuo  
**Ambiente:** Firebase Realtime Database (Produção Oficial)  
**Projeto Firebase:** `rodizio-almoco-equipe`  
**Endpoint Remoto:** `https://rodizio-almoco-equipe-default-rtdb.firebaseio.com/`  
**Responsável Técnico:** Antigravity AI Assistant & Operador do Sistema  

---

## 1. Resumo Executivo — Vulnerabilidade Fechada em Produção

```text
Antes do deploy:
Realtime Database → VULNERÁVEL (.read = true, .write = true expostos)

Depois do deploy das Security Rules:
Realtime Database → PROTEGIDO (HTTP 401 PERMISSION_DENIED confirmado via REST)
```

A vulnerabilidade crítica de leitura e escrita anônimas no Firebase Realtime Database foi **completamente eliminada na nuvem**.

O deploy real das Security Rules foi executado com sucesso pelo Firebase CLI autenticado (`v15.32.1`) diretamente sobre o projeto `rodizio-almoco-equipe`.

---

## 2. Evidência Técnica do Deploy Real

```text
=== Deploying to 'rodizio-almoco-equipe'...

i  deploying database
i  database: checking rules syntax...
+  database: rules syntax for database rodizio-almoco-equipe-default-rtdb is valid
i  database: releasing rules...
+  database: rules for database rodizio-almoco-equipe-default-rtdb released successfully

+  Deploy complete!

Project Console: https://console.firebase.google.com/project/rodizio-almoco-equipe/overview
```

As regras ativas foram inspecionadas diretamente via requisição administrativa com Bearer token OAuth no endpoint `/.settings/rules.json`, confirmando que correspondem 100% ao arquivo [`database.rules.json`](database.rules.json).

---

## 3. Provas REST Reais Contra o Firebase em Produção

Execução de requisições anônimas diretas contra a URL `https://rodizio-almoco-equipe-default-rtdb.firebaseio.com/`:

| Teste | Método HTTP | Endpoint Testado | Resposta Obtida | Status de Segurança |
| :--- | :---: | :--- | :---: | :---: |
| **TESTE 1** | `GET` | `/.json` (Raiz completa) | `HTTP 401 Permission denied` | ✔ **BLOQUEADO** |
| **TESTE 2** | `GET` | `/scadahub_settings.json` | `HTTP 401 Permission denied` | ✔ **BLOQUEADO** |
| **TESTE 3** | `PUT` | `/pentest_live_check.json` | `HTTP 401 Permission denied` | ✔ **BLOQUEADO** |

> [!NOTE]
> O servidor rejeitou categoricamente todas as requisições anônimas. Nenhuma leitura ou escrita sem autenticação é mais aceita pelo Firebase em produção.

---

## 4. Mapeamento das Contas do Firebase Authentication

A consulta administrativa ao serviço de autenticação do projeto revelou que o **Firebase Authentication** ainda não foi inicializado/configurado com contas ativas no console do projeto.

Portanto, em cumprimento estrito da regra de não inventar dados ou UIDs:

```text
USUÁRIO SEM CONTA FIREBASE:
- emp-1: Mateus de Oliveira Silva (Líder da Equipe - Administrador Previsto)
- emp-2: Mateus Augusto Santos Gomes (Dev Jr)
- emp-3: Monique Aparecida Hileshein (Dev Jr)
- emp-4: Samara Revoredo (Dev Pleno)
```

### Procedimento de Mapeamento Futuro:
Assim que o operador criar as contas no Firebase Console (menu *Authentication*), deve-se associar o UID real de cada usuário em:
- `/scadahub_users/<UID_MATEUS_O>` ➔ `{ "uid": "<UID>", "employeeId": "emp-1", "role": "admin", "name": "Mateus de Oliveira Silva" }`
- `/scadahub_admins/<UID_MATEUS_O>` ➔ `true`
- `/scadahub_users/<UID_MATEUS_G>` ➔ `{ "uid": "<UID>", "employeeId": "emp-2", "role": "user", "name": "Mateus Augusto Santos Gomes" }`
- `/scadahub_users/<UID_MONIQUE>` ➔ `{ "uid": "<UID>", "employeeId": "emp-3", "role": "user", "name": "Monique Aparecida Hileshein" }`
- `/scadahub_users/<UID_SAMARA>` ➔ `{ "uid": "<UID>", "employeeId": "emp-4", "role": "user", "name": "Samara Revoredo" }`

---

## 5. Matriz Completa de Validação de Permissões (26/26 Testes Aprovados)

```text
================================================================
    RELATÓRIO DE EXECUÇÃO — PENETRATION TEST RODÍZIO DE ALMOÇO    
================================================================

--- 1. PROVAS DIRETAS CONTRA O FIREBASE EM PRODUÇÃO ---
✔ [PASS] PRODUÇÃO_REMOTO  | Leitura não autenticada da raiz /.json em produção
✔ [PASS] PRODUÇÃO_REMOTO  | Leitura de scadahub_settings sem autenticação em produção
✔ [PASS] PRODUÇÃO_REMOTO  | Escrita não autenticada via REST em produção

--- 2. AVALIAÇÃO DAS REGRAS PUBLICADAS (database.rules.json) ---
✔ [PASS] RULES_USER       | USER_A tenta alterar próprio role para "admin" → PERMISSION_DENIED
✔ [PASS] RULES_USER       | USER_A tenta alterar seu próprio employeeId para "emp-3" → PERMISSION_DENIED
✔ [PASS] RULES_USER       | USER_A tenta editar perfil de USER_B em scadahub_users → PERMISSION_DENIED
✔ [PASS] RULES_USER       | USER_A tenta adicionar próprio UID em scadahub_admins → PERMISSION_DENIED (.write: false)
✔ [PASS] RULES_USER       | USER_A edita próprio perfil em scadahub_employees (campos permitidos) → ALLOWED
✔ [PASS] RULES_USER       | USER_A tenta alterar cargo/função (role) em scadahub_employees → PERMISSION_DENIED
✔ [PASS] RULES_USER       | USER_A tenta alterar status active em scadahub_employees → PERMISSION_DENIED
✔ [PASS] RULES_USER       | USER_A tenta criar novo funcionário em scadahub_employees → PERMISSION_DENIED
✔ [PASS] RULES_USER       | USER_A tenta excluir funcionário USER_B de scadahub_employees → PERMISSION_DENIED
✔ [PASS] RULES_USER       | USER_A edita sua própria escala no dia atual → ALLOWED
✔ [PASS] RULES_USER       | USER_A exclui sua própria escala → ALLOWED
✔ [PASS] RULES_USER       | USER_A edita própria escala no PASSADO → ALLOWED (sem restrição temporal)
✔ [PASS] RULES_USER       | USER_A cria própria escala no FUTURO → ALLOWED (sem restrição temporal)
✔ [PASS] RULES_USER       | USER_A tenta alterar escala de USER_B (slot-3) → PERMISSION_DENIED
✔ [PASS] RULES_USER       | USER_A tenta excluir escala de USER_B → PERMISSION_DENIED
✔ [PASS] RULES_USER       | USER_A tenta trocar employeeId do seu slot para USER_B → PERMISSION_DENIED
✔ [PASS] RULES_USER       | USER_A tenta alterar scadahub_settings → PERMISSION_DENIED
✔ [PASS] RULES_ADMIN      | ADMIN edita qualquer funcionário (incluindo cargo/status) → ALLOWED
✔ [PASS] RULES_ADMIN      | ADMIN cria novo funcionário em scadahub_employees → ALLOWED
✔ [PASS] RULES_ADMIN      | ADMIN exclui funcionário de scadahub_employees → ALLOWED
✔ [PASS] RULES_ADMIN      | ADMIN edita qualquer escala (escala de USER_B) → ALLOWED
✔ [PASS] RULES_ADMIN      | ADMIN exclui qualquer escala (escala de USER_B) → ALLOWED
✔ [PASS] RULES_ADMIN      | ADMIN altera scadahub_settings → ALLOWED

TOTAL DE TESTES EXECUTADOS: 26
TESTES APROVADOS: 26 (100% PASS)
TESTES REPROVADOS: 0
================================================================
```

---

## 6. Testes de Regressão e Integridade da Aplicação

```bash
npm test        → 16/16 testes aprovados (Suítes RBAC e Algoritmo de Escala)
npm run lint    → 0 erros
npm run build   → Build de produção gerado com sucesso pelo Vite
```

---

## 7. Limpeza de Artefatos de Pentest

* Foi verificado diretamente no Realtime Database que o nó `/pentest_live_check` **retorna `null`**.
* Nenhum dado de teste residual ou fictício permanece na base de dados de produção.
* Nenhum dado legítimo dos 4 colaboradores ou das escalas existentes foi alterado ou apagado.

---

## 8. Relatório Conforme Padrão Obrigatório

```text
SECURITY RULES DEPLOYADAS: SIM (Confirmadas na nuvem via Firebase CLI e REST)

PROJETO FIREBASE: rodizio-almoco-equipe

READ ANÔNIMO: DENIED (HTTP 401)

WRITE ANÔNIMO: DENIED (HTTP 401)

USER_A → PRÓPRIA ESCALA: ALLOWED

USER_A → ESCALA USER_B: DENIED

USER_A → ADMIN: DENIED

ADMIN → ESCALA USER_B: ALLOWED

ADMIN → CONFIGURAÇÕES: ALLOWED
```

---

## 9. Status Final

```text
STATUS FINAL: VALIDADO
```
