# Arquitetura de Segurança e Limites de Confiança — Rodízio de Almoço (scadahub)

Este documento descreve a topologia de segurança, os fluxos de dados e as fronteiras de confiança (*trust boundaries*) do sistema **Rodízio de Almoço**.

---

## 1. Diagrama da Arquitetura Real

```text
                           [ NAVEGADOR DO CLIENTE ]
                                      │
              ┌───────────────────────┴───────────────────────┐
              ▼                                               ▼
       [ Usuário Admin ]                             [ Usuário Normal ]
              │                                               │
              └───────────────────────┬───────────────────────┘
                                      │
                                      ▼
                        [ Camada Frontend - React 19 ]
                                      │
                 ┌────────────────────┼────────────────────┐
                 ▼                    ▼                    ▼
          [ AuthModal / RBAC ] [ Navbar / UI ] [ LocalStorage (Cache/Tema) ]
                 │
  ====================================│==================================== [ FRONTEIRA DE CONFIANÇA 1 ]
                 │ (Token JWT / Auth)
                 ▼
     [ Firebase Authentication ]
                 │
  ====================================│==================================== [ FRONTEIRA DE CONFIANÇA 2 ]
                 │ (Avaliação Server-Side Inegociável)
                 ▼
     [ Firebase Security Rules ]
                 │
       ┌─────────┴─────────┐
       ▼                   ▼
[ Realtime Database ]  [ Cloud Firestore ]
  - scadahub_admins      - scadahub_admins
  - scadahub_users       - scadahub_users
  - scadahub_employees   - scadahub_employees
  - scadahub_schedules   - scadahub_schedules
  - scadahub_settings    - scadahub_settings
```

---

## 2. Limites de Confiança (Trust Boundaries)

### Limite 1: Cliente / Navegador (Ambiente Não Confiável)
* **Composição:** JavaScript em execução na máquina do usuário, variáveis de estado React, DOM, LocalStorage, DevTools.
* **Premissa:** Qualquer código executado neste ambiente pode ser inspecionado, pausado via breakpoints, alterado em tempo de execução ou contornado.
* **Postura:** Nenhuma decisão crítica de segurança é delegada exclusivamente ao cliente. A UI apenas fornece feedback instantâneo e boa ergonomia de uso.

### Limite 2: Autenticação Criptográfica (Firebase Auth)
* **Composição:** Infraestrutura Google Identity Platform.
* **Premissa:** Assegura a identidade da requisição emitindo um token JWT assinado criptograficamente contendo o identificador único (`auth.uid`).
* **Postura:** O cliente não pode forjar nem alterar seu `uid` sem invalidar a assinatura da chave pública do Google.

### Limite 3: Autorização de Dados (Firebase Security Rules)
* **Composição:** Mecanismo server-side do Realtime Database e Cloud Firestore.
* **Premissa:** Intercepta cada leitura, criação, atualização e exclusão, confrontando o payload com a identidade autenticada e as permissões de banco.
* **Postura:** Barreira inegociável onde as regras de negócio são aplicadas.

---

## 3. Fluxos de Dados e Autorização

### 3.1. Fluxo de Edição da Escala (Turnos de Almoço)

```text
[ Usuário ] ──> Clica no Horário na Timeline/Cards
     │
     ▼
[ EditSlotModal ]
     │
     ├── Checa se isAdmin || (slot.employeeId === currentUser.employeeId)
     │       │
     │       ├── Se NÃO: Bloqueia campos e exibe mensagem de alerta
     │       │
     │       └── Se SIM: Permite alteração de horário (11:30 às 13:30 ou outro)
     │
     ▼
[ firebaseService.pushDaySchedule() ]
     │
     ▼
[ Firebase Security Rules ]
     │
     ├── Valida: auth != null ? (Se não, PERMISSION_DENIED)
     │
     ├── Valida: É Admin? (Se sim, PERMITIR)
     │
     └── Valida: slot.employeeId == user.employeeId ?
             │
             ├── Se SIM: PERMITIR (Atualiza no banco em tempo real)
             └── Se NÃO: PERMISSION_DENIED (Transação abortada)
```

> **Nota Crítica sobre a Escala:** Usuários normais podem editar sua própria escala em **qualquer data (hoje, ontem, mês passado ou daqui a 6 meses)** sem qualquer restrição temporal artificial. A única restrição é não poder alterar o horário de outro colega.

---

### 3.2. Fluxo de Gerenciamento de Funcionários

```text
[ Usuário ] ──> Acessa Aba "Equipe"
     │
     ▼
[ TeamView.jsx ]
     │
     ├── Se isAdmin === true:
     │     - Exibe botão "Adicionar Colaborador"
     │     - Exibe ícones de exclusão (lixeira)
     │     - Permite alterar horários contratuais e cargos de qualquer membro
     │
     └── Se isAdmin === false:
           - Oculta botões de adicionar e excluir
           - Permite editar APENAS o próprio perfil (nome de exibição/foto)
           - Campos de cargo (role) e status ficam desabilitados
     │
     ▼
[ Firebase Server Rules ]
     │
     ├── Tentativa de CREATE/DELETE por usuário normal -> PERMISSION_DENIED
     └── Tentativa de alterar "role" para "admin" por usuário normal -> PERMISSION_DENIED
```

---

### 3.3. Fluxo de Configurações e Manutenção

```text
[ Usuário ] ──> Tenta navegar para Aba "Configurações"
     │
     ▼
[ App.jsx Guard (handleSelectTab) ]
     │
     ├── Se NÃO é Admin:
     │     - Redireciona imediatamente para o Dashboard
     │     - Exibe Toast: "Acesso restrito: Aba exclusiva para Administradores"
     │
     └── Se É Admin:
           - Renderiza SettingsView
           - Permite alteração da janela crítica de atendimento (11:30 - 13:30)
           - Permite sincronização manual com a nuvem
           - Exige digitar "RESTAURAR" para zerar dados locais aos padrões
     │
     ▼
[ Firebase Server Rules ]
     │
     └── scadahub_settings -> Escrita permitida unicamente se root.child('scadahub_admins').child(auth.uid).val() === true
```

---

## 4. Análise de Ameaças (Modelo STRIDE)

| Ameaça | Vetor no Sistema | Mitigação Implementada |
| :--- | :--- | :--- |
| **Spoofing (Falsificação)** | Atacante fingir ser outro funcionário na escala | Autenticação via Firebase Auth + amarração entre `auth.uid` e `employeeId` nas regras do banco. |
| **Tampering (Adulteração)** | Alterar regras de atendimento ou escala alheia | Regras de segurança no Realtime Database e Firestore validam titularidade e papel administrativo. |
| **Repudiation (Repúdio)** | Negar autoria de alteração em horário de almoço | Cada transação exige token autenticado associado ao colaborador responsável. |
| **Information Disclosure** | Exposição de senhas ou dados confidenciais | Remoção de senha hardcoded (`useradminshub`), restrição de leitura na raiz do banco e uso de HTTPS. |
| **Denial of Service** | Escritas em massa ou flood de transações | Validação de nós específicos e ausência de nós abertos a escrita anônima. |
| **Elevation of Privilege** | Usuário normal alterar `role` para `admin` | Regras no banco proíbem especificamente mutações de papel (`newData.child('role').val() != 'admin'`). |
