# Documentação Oficial de Autenticação e Autorização — Rodízio de Almoço (scadahub)

Este documento especifica a arquitetura, o fluxo de ciclo de vida e os procedimentos operacionais de **Autenticação e Autorização (RBAC)** do sistema **Rodízio de Almoço**.

---

## 1. Arquitetura de Autenticação e Autorização

O sistema adota uma separação rigorosa de responsabilidades:
* **Frontend:** Responsável pela experiência do usuário, validação inicial de formulários e estados visuais.
* **Firebase Authentication:** Responsável pela autenticação criptográfica (e-mail e senha) e emissão de tokens JWT invioláveis.
* **Firebase Security Rules:** Barreira server-side inegociável que valida todas as requisições contra o Realtime Database e Cloud Firestore.

```text
               [ Usuário Não Autenticado ]
                           │
                           ▼
                  [ Tela de Login Real ]
             (E-mail e Senha - Sem Bypass)
                           │
                           ▼
             [ Firebase Authentication API ]
              (signInWithEmailAndPassword)
                           │
               ┌───────────┴───────────┐
               │                       │
          (Sucesso)                 (Falha)
               │                       │
               ▼                       ▼
      [ Emissão do Token ]    [ Mensagem Amigável ]
         (auth.uid)            (Acesso Bloqueado)
               │
               ▼
      [ onAuthStateChanged ]
               │
               ├── 1. Consulta /scadahub_admins/<uid>
               │
               ├── 2. Consulta /scadahub_users/<uid>
               │
               ▼
    [ Identificação Resolvida ]
    - UID: <uid>
    - Papel: ADMIN | NORMAL
    - Colaborador: employeeId
               │
               ▼
    [ Liberação do Dashboard ]
```

---

## 2. Bloqueio Estrito de Acesso Não Autenticado

1. **Estado Inicial:** A aplicação inicia no estado de verificação (`Verificando sessão...`), aguardando a resposta do ouvinte oficial `onAuthStateChanged`.
2. **Usuário Não Logado:** Se não houver usuário autenticado no Firebase Authentication, o componente `LoginScreen` é renderizado de forma exclusiva. **Nenhum componente do Dashboard, Timeline, Equipe, Configurações ou dados de escalas é renderizado no DOM nem consultado na rede**.
3. **Impossibilidade de Bypass no Cliente:** Mesmo que um usuário force parâmetros na URL ou altere variáveis no DevTools, os componentes de negócio exigem a sessão ativa e qualquer requisição direta aos nós do Firebase é sumariamente rejeitada com `PERMISSION_DENIED`.

---

## 3. Relação entre Identidades: Auth UID -> Usuário -> Funcionário

O mapeamento de autorização é unívoco e estruturado da seguinte forma:

```text
Firebase Auth UID
       │
       ▼
scadahub_users/<uid>
       │
       ├── role: 'admin' | 'user'
       ├── employeeId: 'emp-X'
       └── email: 'usuario@scadahub.com'
       │
       ▼
scadahub_employees/<empId>
       │
       ▼
scadahub_schedules/<data>/<slotKey>
  (employeeId do slot deve ser idêntico ao employeeId do usuário)
```

---

## 4. Como Provisionar o Primeiro Administrador

Por segurança contra auto-escalada de privilégios, **não existe cadastro público nem auto-atribuição de papel administrativo pelo frontend**. O provisionamento do primeiro administrador deve ser realizado pelo Console do Firebase ou via Firebase Admin SDK:

1. Acesse o **Firebase Console** -> **Authentication** -> **Users**.
2. Clique em **Add user** (Adicionar usuário) e informe o e-mail corporativo do administrador e uma senha segura.
3. Copie o **User UID** gerado (exemplo: `UID_DO_ADMIN`).
4. Acesse o **Realtime Database** (ou Firestore) e crie os registros:
   - No nó `/scadahub_admins`:
     ```json
     {
       "UID_DO_ADMIN": true
     }
     ```
   - No nó `/scadahub_users/UID_DO_ADMIN`:
     ```json
     {
       "role": "admin",
       "employeeId": "emp-1",
       "name": "Nome do Administrador",
       "email": "admin@scadahub.com"
     }
     ```
5. A partir desse momento, o usuário é reconhecido como **ADMIN** tanto pelo Firebase Authentication quanto pelas Security Rules.

---

## 5. Como Adicionar um Novo Colaborador

1. Crie a conta do colaborador no Firebase Authentication (via Console ou rotina administrativa).
2. Obtenha o `UID` do colaborador.
3. Registre os dados em `/scadahub_users/<UID>`:
   ```json
   {
     "role": "user",
     "employeeId": "emp-novo",
     "name": "Nome do Colaborador",
     "email": "colaborador@scadahub.com"
   }
   ```
4. Registre o funcionário na equipe em `/scadahub_employees/emp-novo` (esta etapa também pode ser feita pela interface na aba **Equipe** por um usuário Administrador).

---

## 6. Como Funciona a Autorização da Escala

* **Usuário Normal:**
  - Possui controle total para criar, editar ou excluir **exclusivamente os slots de almoço que pertencem ao seu próprio `employeeId`**.
  - Este direito é garantido em **qualquer dia, semana ou período** (passado, presente ou futuro).
  - É **terminantemente proibido** de modificar ou excluir horários de colegas.
* **Administrador:**
  - Possui controle total para visualizar, ajustar, gerar em lote e reorganizar horários de qualquer colaborador da equipe em qualquer data.

---

## 7. Como Funciona o Logout

1. O usuário clica no botão **Sair** localizado no cabeçalho da aplicação.
2. O sistema invoca `firebaseService.signOutAuth()`, acionando a API oficial `signOut(auth)` do Firebase Authentication.
3. A sessão é invalidada imediatamente no cliente e no servidor.
4. O estado reativo `currentUser` torna-se `null`.
5. A aplicação desmonta toda a interface operacional e remonta a **Tela de Login**.
6. O uso dos botões "Voltar" ou "Avançar" do navegador não recupera a sessão encerrada.

---

## 8. Como Revogar o Acesso de um Usuário

Para revogar o acesso de qualquer colaborador:
1. No **Firebase Console** -> **Authentication**, localize o usuário e selecione **Disable account** (Desativar conta) ou **Delete user** (Excluir usuário).
2. O Firebase revogará a renovação do token, e qualquer tentativa subsequente de autenticação retornará o erro tratado: *"Esta conta de usuário foi desativada pelo administrador."*
3. Caso o colaborador possua privilégios administrativos prévios, remova também sua chave em `/scadahub_admins/<UID>`.

---

## 9. Onde Estão as Security Rules

* **Realtime Database:** Localizado na raiz do projeto em [`database.rules.json`](database.rules.json).
* **Cloud Firestore:** Localizado na raiz do projeto em [`firestore.rules`](firestore.rules).
* **Configuração Firebase CLI:** Arquivo [`firebase.json`](firebase.json).

---

## 10. Como Executar os Testes Automatizados de Segurança

A suíte de testes automatizados valida tanto a lógica de negócio do escalonador quanto a matriz de permissões RBAC:

```bash
npm test
```

Os testes cobrem:
* Integridade dos arquivos de regras;
* Permissões e restrições de Administrador (`ADMIN`);
* Permissões e restrições do Usuário Normal A (`USER_A`);
* Permissões e restrições espelhadas do Usuário Normal B (`USER_B`);
* Bloqueio estrito de escrita para usuários não autenticados;
* Ciclo de vida completo: Login -> Operação de Escala -> Tentativas de Bypass -> Logout.
