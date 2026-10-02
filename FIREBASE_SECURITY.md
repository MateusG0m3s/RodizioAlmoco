# Arquitetura de Segurança do Firebase — Rodízio de Almoço (scadahub)

Este documento especifica formalmente a modelagem de segurança, o mapeamento de coleções/nós e as regras de autorização no **Firebase Realtime Database** e **Cloud Firestore**.

---

## 1. Princípio Fundamental de Autorização

O sistema obedece estritamente ao seguinte fluxo de confiança:

```text
                    CLIENTE / NAVEGADOR
                            │
                            ▼
                  FIREBASE AUTHENTICATION
                   (Gera token com UID)
                            │
                            ▼
                 FIREBASE SECURITY RULES
         (Avaliação server-side inegociável)
                            │
              ┌─────────────┴─────────────┐
              │                           │
          É ADMIN?                    É NORMAL?
              │                           │
              ▼                           ▼
    Acesso irrestrito a        Apenas dados próprios e
    escalas, equipe e configs  sua própria escala (qualquer dia)
              │                           │
              └─────────────┬─────────────┘
                            ▼
                   BANCO DE DADOS FIREBASE
```

---

## 2. Mapeamento de Coleções e Nós

### 2.1. Nó: `scadahub_admins`
* **Finalidade:** Registro de UIDs com privilégios administrativos no sistema.
* **Quem lê:** Usuários autenticados (para verificar papéis).
* **Quem escreve:** Proibido via cliente (somente Firebase Admin SDK ou Console).
* **Quem atualiza:** Proibido via cliente.
* **Quem exclui:** Proibido via cliente.
* **Proprietário:** Infraestrutura / Administrador Root.
* **Dados armazenados:** Objeto booleano `{ "<uid>": true }`.

### 2.2. Nó: `scadahub_users`
* **Finalidade:** Mapear cada `auth.uid` ao colaborador correspondente (`employeeId`) e definir seu papel (`role`).
* **Quem lê:** Usuários autenticados.
* **Quem escreve:** Próprio usuário no primeiro acesso (com `role: "user"`) ou Admin.
* **Quem atualiza:** Próprio usuário (sem poder alterar seu próprio `role` para admin) ou Admin.
* **Quem exclui:** Somente Admin.
* **Proprietário:** O usuário autenticado cujo `auth.uid` é a chave do documento.
* **Dados armazenados:** `{ uid, email, role, employeeId, name, updatedAt }`.

### 2.3. Nó: `scadahub_employees`
* **Finalidade:** Cadastro dos colaboradores da equipe scadahub (nomes, horários contratuais, papéis).
* **Quem lê:** Usuários autenticados.
* **Quem escreve:** Somente Administradores.
* **Quem atualiza:** Administradores (para qualquer campo) OU o próprio colaborador (apenas campos de exibição, sem alterar `role` ou `active`).
* **Quem exclui:** Somente Administradores.
* **Proprietário:** Administrador (criação e exclusão) e o colaborador titular (edição de perfil).
* **Dados armazenados:** `{ id, name, role, color, shiftStart, shiftEnd, active }`.

### 2.4. Nó: `scadahub_schedules/$dateStr/$slotKey`
* **Finalidade:** Alocações de horários de almoço por data (`YYYY-MM-DD`).
* **Quem lê:** Usuários autenticados.
* **Quem escreve:** Administradores OU o titular do horário (`employeeId === user.employeeId`).
* **Quem atualiza:** Administradores OU o titular do horário.
* **Quem exclui:** Administradores OU o titular do horário.
* **Proprietário:** O colaborador vinculado ao `employeeId` daquele slot.
* **Regra Temporal:** **Controle total em qualquer dia ou semana**. Não há travas para datas futuras ou passadas. A única restrição é a propriedade do turno (não pode alterar slot de terceiros).
* **Dados armazenados:** `{ id, employeeId, startTime, endTime, duration, date }`.

### 2.5. Nó: `scadahub_settings`
* **Finalidade:** Parâmetros de funcionamento e regras da janela crítica de atendimento ao cliente (ex.: 11:30 às 13:30, tolerâncias, tempos padrão).
* **Quem lê:** Usuários autenticados (para exibição de status e cards).
* **Quem escreve:** Exclusivo Administradores.
* **Quem atualiza:** Exclusivo Administradores.
* **Quem exclui:** Proibido.
* **Proprietário:** Administradores.
* **Dados armazenados:** `{ criticalStart, criticalEnd, defaultDuration, minEmployeesWorking, ... }`.

---

## 3. Implementação das Regras no Realtime Database (`database.rules.json`)

```json
{
  "rules": {
    ".read": false,
    ".write": false,

    "scadahub_admins": {
      ".read": "auth != null",
      ".write": false
    },

    "scadahub_users": {
      ".read": "auth != null",
      "$userId": {
        ".write": "auth != null && (root.child('scadahub_admins').child(auth.uid).val() === true || (auth.uid === $userId && (!data.exists() || (newData.child('role').val() === data.child('role').val() || (newData.child('role').val() != 'admin')))))"
      }
    },

    "scadahub_employees": {
      ".read": "auth != null",
      "$empId": {
        ".write": "auth != null && (root.child('scadahub_admins').child(auth.uid).val() === true || (data.exists() && root.child('scadahub_users').child(auth.uid).child('employeeId').val() === $empId && newData.child('role').val() === data.child('role').val() && newData.child('active').val() === data.child('active').val()))"
      }
    },

    "scadahub_schedules": {
      "$dateStr": {
        ".read": "auth != null",
        "$slotKey": {
          ".write": "auth != null && (root.child('scadahub_admins').child(auth.uid).val() === true || (data.exists() && data.child('employeeId').val() === root.child('scadahub_users').child(auth.uid).child('employeeId').val()) || (!data.exists() && newData.child('employeeId').val() === root.child('scadahub_users').child(auth.uid).child('employeeId').val()))"
        }
      }
    },

    "scadahub_settings": {
      ".read": "auth != null",
      ".write": "auth != null && root.child('scadahub_admins').child(auth.uid).val() === true"
    }
  }
}
```

---

## 4. Implementação das Regras no Cloud Firestore (`firestore.rules`)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isAdmin() {
      return isAuthenticated() && (
        request.auth.token.admin == true ||
        exists(/databases/$(database)/documents/scadahub_admins/$(request.auth.uid)) ||
        (exists(/databases/$(database)/documents/scadahub_users/$(request.auth.uid)) && 
         get(/databases/$(database)/documents/scadahub_users/$(request.auth.uid)).data.role == 'admin')
      );
    }
    
    function getUserEmployeeId() {
      return get(/databases/$(database)/documents/scadahub_users/$(request.auth.uid)).data.employeeId;
    }
    
    function isOwnEmployee(empId) {
      return isAuthenticated() && getUserEmployeeId() == empId;
    }
    
    match /scadahub_admins/{uid} {
      allow read: if isAuthenticated();
      allow write: if false;
    }
    
    match /scadahub_users/{uid} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() && request.auth.uid == uid && request.resource.data.role != 'admin';
      allow update: if isAdmin() || (
        isAuthenticated() && 
        request.auth.uid == uid && 
        request.resource.data.role == resource.data.role &&
        request.resource.data.employeeId == resource.data.employeeId
      );
      allow delete: if isAdmin();
    }
    
    match /scadahub_employees/{empId} {
      allow read: if isAuthenticated();
      allow create, delete: if isAdmin();
      allow update: if isAdmin() || (
        isOwnEmployee(empId) &&
        request.resource.data.role == resource.data.role &&
        request.resource.data.active == resource.data.active
      );
    }
    
    match /scadahub_schedules/{dateStr}/slots/{slotId} {
      allow read: if isAuthenticated();
      allow create: if isAdmin() || (isAuthenticated() && request.resource.data.employeeId == getUserEmployeeId());
      allow update: if isAdmin() || (isAuthenticated() && resource.data.employeeId == getUserEmployeeId() && request.resource.data.employeeId == getUserEmployeeId());
      allow delete: if isAdmin() || (isAuthenticated() && resource.data.employeeId == getUserEmployeeId());
    }
    
    match /scadahub_settings/{docId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }
  }
}
```

---

## 5. Como a Propriedade da Escala é Validada

A validação de propriedade elimina qualquer confiança cega nos parâmetros enviados pelo navegador:

1. Quando o cliente solicita a gravação de um slot em `scadahub_schedules/$dateStr/$slotKey`, o Firebase extrai a identidade criptográfica inalterável do token JWT: `request.auth.uid`.
2. O servidor consulta o registro interno em `scadahub_users/$userId` para encontrar qual `employeeId` pertence àquele UID.
3. Se o slot já existe: o valor `data.employeeId` deve ser idêntico ao `employeeId` do usuário logado.
4. Se o slot está sendo criado: o valor `newData.employeeId` deve ser idêntico ao `employeeId` do usuário logado.
5. Se o usuário for Administrador (`scadahub_admins/$uid === true`), a restrição de propriedade é ignorada, permitindo a gestão global dos horários.

---

## 6. Confirmação do Deploy Real em Produção

* **Status:** PUBLICADO E ATIVO EM PRODUÇÃO
* **Data/Hora:** 01/10/2026 às 23:31:43 BRT
* **Projeto Firebase:** `rodizio-almoco-equipe`
* **Realtime Database:** `rodizio-almoco-equipe-default-rtdb`
* **Validação REST Remota:**
  - `GET /.json`: HTTP 401 Permission Denied (confirmado)
  - `GET /scadahub_settings.json`: HTTP 401 Permission Denied (confirmado)
  - `PUT /pentest_live_check.json`: HTTP 401 Permission Denied (confirmado)
* **Vulnerabilidade:** Extinta na infraestrutura em nuvem do Google.

