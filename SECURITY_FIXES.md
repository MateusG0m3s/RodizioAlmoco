# Correções de Segurança Implementadas — Rodízio de Almoço (scadahub)

Este documento detalha todas as correções técnicas aplicadas ao sistema **Rodízio de Almoço**, preservando 100% da experiência de uso (UX), identidade visual e regras de negócio.

---

## Tabela de Correções

| ID | Vulnerabilidade / Risco | Arquivo(s) Modificado(s) | Severidade | Status |
| :--- | :--- | :--- | :---: | :---: |
| **SEC-01** | Senha administrativa hardcoded | `src/components/SettingsView.jsx` | CRÍTICO | ✅ Corrigido |
| **SEC-02** | Ausência de regras no Firebase | `database.rules.json`, `firestore.rules`, `firebase.json` | CRÍTICO | ✅ Corrigido |
| **SEC-03** | Edição de escalas de terceiros | `src/components/EditSlotModal.jsx`, `src/components/TimelineView.jsx`, `database.rules.json` | ALTO | ✅ Corrigido |
| **SEC-04** | Vulnerabilidade a Clickjacking | `index.html` | ALTO | ✅ Corrigido |
| **SEC-05** | Criação e exclusão indevida de equipe | `src/components/TeamView.jsx`, `database.rules.json` | ALTO | ✅ Corrigido |
| **SEC-06** | Falta de CSP restritiva | `index.html` | MÉDIO | ✅ Corrigido |
| **SEC-07** | Escalada de privilégios (`role`) | `database.rules.json`, `firestore.rules`, `src/services/authService.js` | MÉDIO | ✅ Corrigido |
| **SEC-08** | Falta de camada formal de Auth | `src/services/authService.js`, `src/components/AuthModal.jsx`, `src/components/Navbar.jsx` | MÉDIO | ✅ Corrigido |
| **SEC-09** | Acesso direto à aba Configurações | `src/App.jsx`, `src/components/Navbar.jsx` | BAIXO | ✅ Corrigido |
| **SEC-10** | Ausência de cabeçalhos de segurança | `index.html` | BAIXO | ✅ Corrigido |

---

## Detalhamento Técnico das Correções

### 1. [SEC-01] Remoção da Senha Hardcoded no Frontend
* **Antes:**
  ```javascript
  // SettingsView.jsx (Código vulnerável anterior)
  const [adminPassword, setAdminPassword] = useState('');
  const handleResetConfirm = () => {
    if (adminPassword === 'useradminshub') {
      onResetAllData();
    }
  };
  ```
* **Depois:**
  ```javascript
  // SettingsView.jsx (Código seguro corrigido)
  const [confirmText, setConfirmText] = useState('');
  const handleResetConfirm = () => {
    if (!isAdmin) {
      alert('Acesso restrito: apenas administradores podem restaurar padrões.');
      return;
    }
    if (confirmText.trim().toUpperCase() === 'RESTAURAR') {
      onResetAllData();
    }
  };
  ```
* **Benefício:** A segurança não depende de segredos no frontend. Somente usuários autenticados com o perfil de administrador (`isAdmin === true`) conseguem disparar ações de manutenção.

---

### 2. [SEC-02] Regras de Segurança Estritas no Firebase
* **Antes:** Arquivos de regras inexistentes no repositório; permissões abertas por padrão no Realtime Database.
* **Depois:** Criação de `database.rules.json` e `firestore.rules`.
  ```json
  {
    "rules": {
      ".read": false,
      ".write": false,
      "scadahub_schedules": {
        "$date": {
          ".read": "auth != null",
          "$slot": {
            ".write": "auth != null && (root.child('scadahub_admins').child(auth.uid).val() === true || (data.exists() && data.child('employeeId').val() === root.child('scadahub_users').child(auth.uid).child('employeeId').val()) || (!data.exists() && newData.child('employeeId').val() === root.child('scadahub_users').child(auth.uid).child('employeeId').val()))"
          }
        }
      }
    }
  }
  ```
* **Benefício:** Acesso não autenticado é completamente bloqueado. Cada slot de horário só pode ser gravado se o colaborador do slot bater com o usuário autenticado ou se for administrador.

---

### 3. [SEC-03] Proteção da Propriedade da Escala
* **Antes:** Qualquer usuário na interface podia clicar em qualquer horário de almoço e alterá-lo.
* **Depois:**
  - `EditSlotModal.jsx`: Validação da propriedade:
    ```javascript
    const isOwner = currentUserEmployeeId && slot?.employeeId === currentUserEmployeeId;
    const isAllowedToEdit = isAdmin || isOwner;
    ```
    Caso não seja permitido, os campos ficam em modo somente leitura (desabilitados) e o botão "Salvar" exibe alerta visual de permissão negada.
  - `TimelineView.jsx`: O recurso de arrastar e soltar (drag and drop) é desabilitado para turnos de outros colaboradores (`draggable={isAllowedToEdit}`). Turnos de terceiros exibem ícone de cadeado.
  - **Regra Fundamental Respeitada:** O usuário normal tem controle total sobre seu horário em **qualquer data (hoje, ontem, semana que vem, mês passado)**, mas não pode alterar turnos de outros colaboradores.

---

### 4. [SEC-04] Proteção contra Clickjacking e Framing
* **Antes:** Ausência de proteções contra carregamento em iframes.
* **Depois:** Adicionados em `index.html`:
  ```html
  <meta http-equiv="Content-Security-Policy" content="frame-ancestors 'none'; ...">
  <script>
    if (window.top !== window.self) {
      window.top.location = window.self.location;
    }
  </script>
  ```
* **Benefício:** Impede ataques de sobreposição de interface (UI Redressing).

---

### 5. [SEC-05] Gestão Segura de Colaboradores (TeamView)
* **Antes:** Usuários normais visualizavam botão "Adicionar Funcionário" e ícones de exclusão.
* **Depois:**
  - `TeamView.jsx`: Botão "Novo Colaborador" e botão de exclusão são renderizados apenas para `isAdmin`.
  - Usuários normais podem editar unicamente seu próprio cadastro (foto, apelido), sem poder alterar o papel (`role`) ou desativar outros colaboradores.
  - Regras no Firebase validam a exclusão e criação exclusivamente por administradores.

---

### 6. [SEC-06 & SEC-07] Prevenção de Escalada de Privilégios
* **Antes:** Não havia restrição para alteração de papéis caso o payload incluísse `role: "admin"`.
* **Depois:** As regras do Firebase e o `authService.js` impedem a elevação do campo `role`:
  ```javascript
  // Regra do Firestore
  allow update: if isAdmin() || (
    isAuthenticated() && 
    request.auth.uid == uid && 
    request.resource.data.role == resource.data.role
  );
  ```

---

### 7. [SEC-08] Serviço de Autenticação e RBAC (AuthService + AuthModal)
* **Antes:** Aplicação operava sem controle explícito de login, dependendo de mock local.
* **Depois:** Criado `authService.js` com integração a Firebase Auth (`signInWithEmailAndPassword`, `onAuthStateChanged`, `signOut`) e chaveamento instantâneo de contas para testes e auditoria (`ADMIN`, `USER_A`, `USER_B`, `USER_C`).
* Adicionado componente visual `AuthModal.jsx` com modal elegante e indicador de usuário logado na `Navbar.jsx` exibindo badge de papel (`👑 Admin` ou `👤 Normal`).

---

### 8. [SEC-09] Proteção da Aba Configurações
* **Antes:** A aba podia ser acessada alterando o estado local.
* **Depois:**
  - O botão "Configurações" na `Navbar.jsx` só é exibido se `isAdmin === true`.
  - No `App.jsx`, a navegação é protegida com redirecionamento e notificação de acesso negado.
  - No backend (`database.rules.json` e `firestore.rules`), a leitura e escrita do nó de configurações (`scadahub_settings`) é restrita a administradores.
