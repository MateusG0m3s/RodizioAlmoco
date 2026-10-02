# Relatório Completo de Auditoria de Segurança — Rodízio de Almoço (scadahub)

**Data da Auditoria:** 01/10/2026  
**Sistema:** Rodízio de Almoço & Atendimento Contínuo  
**Tecnologia:** React 19, Vite 8, Firebase Realtime Database, Cloud Firestore, Firebase Authentication  
**Status Geral:** Corrigido e Fortalecido com Arquitetura Baseada em Identidade e Menor Privilégio  

---

## 1. Sumário Executivo

O sistema **Rodízio de Almoço** passou por uma auditoria completa de segurança cobrindo todas as camadas de sua arquitetura: código-fonte frontend (JavaScript/React), autenticação de usuários, autorização em banco de dados na nuvem (Firebase Realtime Database e Cloud Firestore), validação de regras de negócio, proteções contra ataques no navegador (XSS, Clickjacking, CSP), dependências de pacotes e histórico de versionamento.

A premissa central de segurança adotada foi: **o frontend controla a experiência do usuário, enquanto o Firebase controla a autorização**. Dessa forma, mesmo que um agente mal-intencionado manipule parâmetros de rede ou execute comandos via DevTools, as regras no Firebase rejeitam transações não autorizadas.

---

## 2. Escopo da Auditoria e Componentes Analisados

| Camada | Tecnologia / Componente | Status da Análise |
| :--- | :--- | :--- |
| **Frontend UI** | React 19, Vite 8, CSS Vanilla, Lucide Icons | Auditado e Reforçado |
| **Camada de Autenticação** | Firebase Authentication + RBAC Service | Implementado e Vinculado |
| **Banco de Dados em Tempo Real** | Firebase Realtime Database (`database.rules.json`) | Criado com Regras Restritas |
| **Banco de Dados Documental** | Cloud Firestore (`firestore.rules`) | Criado com Regras Restritas |
| **Armazenamento de Arquivos** | Firebase Storage | Não utilizado na arquitetura |
| **Funções Serverless** | Cloud Functions | Não utilizado na arquitetura |
| **Hospedagem & CDN** | GitHub Pages, Google Fonts, CDNs externas | Auditado com CSP e Framebusting |
| **Dependências & Supply Chain** | NPM (`package.json`, `package-lock.json`) | Auditado via `npm audit` |
| **Segredos & Histórico Git** | Variáveis de ambiente, commits e repositório | Sanitizado e verificado |

---

## 3. Matriz de Permissões e Regras de Negócio Oficiais

O sistema implementa dois perfis de acesso estritos:
* **ADMIN**: Controle administrativo irrestrito sobre colaboradores, escalas, configurações e manutenção.
* **USUÁRIO NORMAL**: Controle total e exclusivo **sobre a sua própria escala** em qualquer dia ou semana (presente, passado ou futuro). **Proibido** criar, excluir ou editar perfis alheios, alterar escalas de terceiros ou acessar a aba Configurações.

| Recurso / Operação | Administrador | Usuário Normal | Local de Aplicação da Regra |
| :--- | :---: | :---: | :--- |
| **Visualizar Escala** | ✅ Permitido | ✅ Permitido | Frontend & Firebase Rules |
| **Criar Funcionário** | ✅ Permitido | ❌ Negado | Firebase Security Rules + Client Guard |
| **Excluir Funcionário** | ✅ Permitido | ❌ Negado | Firebase Security Rules + Client Guard |
| **Editar Qualquer Funcionário** | ✅ Permitido | ❌ Negado | Firebase Security Rules + Client Guard |
| **Editar Próprio Perfil** | ✅ Permitido | ✅ Permitido | Firebase Security Rules (`uid` match) |
| **Editar Perfil de Terceiros** | ✅ Permitido | ❌ Negado | Firebase Security Rules (`uid` mismatch) |
| **Editar Própria Escala** | ✅ Permitido | ✅ Permitido | Firebase Security Rules (`employeeId` match) |
| **Editar Própria Escala em Qualquer Dia** | ✅ Permitido | ✅ Permitido | Sem trava temporal artificial |
| **Editar Própria Escala em Qualquer Semana** | ✅ Permitido | ✅ Permitido | Sem trava temporal artificial |
| **Editar Escala de Outro Usuário** | ✅ Permitido | ❌ Negado | Firebase Security Rules (`employeeId` mismatch) |
| **Restaurar Padrões de Fábrica** | ✅ Permitido | ❌ Negado | Exclusivo Admin (Firebase + UI) |
| **Acessar Aba Configurações** | ✅ Permitido | ❌ Negado | Ocultado na UI + Bloqueado no Firebase |
| **Configurações Técnicas de Manutenção** | ✅ Permitido | ❌ Negado | Firebase Security Rules (`scadahub_settings`) |
| **Modificar Regras de Atendimento (11:30 - 13:30)**| ✅ Permitido | ❌ Negado | Firebase Security Rules (`scadahub_settings`) |

---

## 4. Classificação dos Problemas Identificados

```text
Classificação Consolidada:
Críticos:     2
Altos:        3
Médios:       4
Baixos:       3
Informativos: 2
Total:        14
```

---

### [SEC-01] Senha Administrativa Exposta em Texto Claro no Frontend
* **Severidade:** CRÍTICO
* **Arquivo / Recurso:** `src/components/SettingsView.jsx`
* **Descrição:** O componente `SettingsView` continha a validação `adminPassword === 'useradminshub'` gravada diretamente no código JavaScript.
* **Impacto:** Qualquer usuário que inspecionasse os scripts da aplicação ou o bundle minificado no navegador conseguia extrair a senha e obter acesso à área de restauração e configurações técnicas.
* **Como poderia ser explorado:** Abrindo as ferramentas de desenvolvedor (F12) e pesquisando pela string ou acessando o estado do componente.
* **Correção:** Remoção completa da senha estática em texto claro. O acesso agora é condicionado à identidade autenticada via Firebase Auth e checagem de permissão RBAC vinculada ao `auth.uid`. A restauração de fábrica agora exige confirmação explícita digitando "RESTAURAR" apenas se o usuário for administrador comprovado.
* **Status:** Resolvido

---

### [SEC-02] Ausência de Regras de Segurança Declaradas para o Banco de Dados
* **Severidade:** CRÍTICO
* **Arquivo / Recurso:** Raiz do repositório (arquivos `database.rules.json` e `firestore.rules` ausentes)
* **Descrição:** O repositório não possuía regras de segurança locais versionadas para o Realtime Database nem Firestore. Bancos recém-criados no modo teste expõem leitura e escrita públicas.
* **Impacto:** Usuários não autenticados ou com tokens de leitura básica poderiam reescrever todos os dados de escalas, apagar colaboradores ou alterar configurações de atendimento diretamente via REST API do Firebase.
* **Como poderia ser explorado:** Enviando requisições HTTP `PUT` ou `DELETE` para `https://<projeto>-default-rtdb.firebaseio.com/scadahub_employees.json`.
* **Correção:** Criação dos arquivos `database.rules.json` e `firestore.rules` com bloqueio total de acessos anônimos (`.read: false`, `.write: false` na raiz) e permissões granulares por nó com checagem de admin e de propriedade do colaborador.
* **Status:** Resolvido

---

### [SEC-03] Falta de Associação Criptográfica entre Usuário Autenticado e Propriedade do Turno
* **Severidade:** ALTO
* **Arquivo / Recurso:** `src/services/firebaseService.js`, `src/components/EditSlotModal.jsx`
* **Descrição:** A gravação de escalas permitia que qualquer cliente enviasse um array contendo horários de qualquer colaborador, sem validação se o usuário logado era de fato o dono daquele horário.
* **Impacto:** Um colaborador mal-intencionado podia forjar um payload no console do navegador e alterar o almoço de um colega, transferindo seu plantão indevidamente.
* **Como poderia ser explorado:** Chamando `firebaseService.pushDaySchedule('2026-10-02', [ { employeeId: 'emp-colega', startTime: '14:00' } ])` pelo console.
* **Correção:** As regras do Firebase agora comparam o `auth.uid` com a coleção `scadahub_users`, verificando se o `employeeId` gravado corresponde exatamente ao colaborador associado. O modal de edição no cliente valida `isAdmin || isOwner` antes de abrir ou salvar.
* **Status:** Resolvido

---

### [SEC-04] Falta de Cabeçalhos de Proteção contra Clickjacking e Framing
* **Severidade:** ALTO
* **Arquivo / Recurso:** `index.html`
* **Descrição:** A página HTML não continha diretivas CSP contra incorporação em frames externos (`frame-ancestors`), permitindo que a aplicação fosse carregada dentro de `<iframe>` por domínios maliciosos.
* **Impacto:** Engenharia social via clickjacking, sobrepondo camadas invisíveis para induzir o usuário a clicar em botões de exclusão ou alteração de escala.
* **Como poderia ser explorado:** Criação de um site atacante com `iframe src="https://mateus-o-silva.github.io/RodizioAlmoco/"` transparente.
* **Correção:** Adicionada meta tag CSP com restrições e script inline de framebusting imediato no `<head>` do `index.html` (`if (window.top !== window.self) window.top.location = window.self.location;`).
* **Status:** Resolvido

---

### [SEC-05] Gestão de Funcionários sem Barreira de Papel (Role) no Servidor
* **Severidade:** ALTO
* **Arquivo / Recurso:** `src/components/TeamView.jsx`, `database.rules.json`
* **Descrição:** Usuários normais tinham acesso às interfaces de adição e exclusão de funcionários no cliente, sem validação server-side.
* **Impacto:** Qualquer usuário normal podia excluir membros da equipe ou cadastrar usuários fantasmas.
* **Como poderia ser explorado:** Acessando a aba Equipe e clicando em excluir colaborador.
* **Correção:** Botão de adição e ícone de lixeira ocultados para usuários não-administradores. Nas regras do Firebase, a escrita no nó `scadahub_employees` é restrita exclusivamente a administradores, exceto atualizações do próprio funcionário que não alterem seu papel (`role`) ou status.
* **Status:** Resolvido

---

### [SEC-06] Falta de Content Security Policy (CSP) Restritiva
* **Severidade:** MÉDIO
* **Arquivo / Recurso:** `index.html`
* **Descrição:** Ausência de política de segurança de conteúdo permitindo execução de scripts e conexões com domínios arbitrários.
* **Impacto:** Em caso de eventual injeção de dependência ou XSS, scripts atacantes poderiam exfiltrar dados para servidores externos.
* **Correção:** Injetada meta tag `Content-Security-Policy` permitindo conexões apenas com `https://*.firebaseio.com`, `wss://*.firebaseio.com`, `https://*.googleapis.com` e fontes oficiais Google.
* **Status:** Resolvido

---

### [SEC-07] Ausência de Proteção contra Escalada de Privilégios no Perfil
* **Severidade:** MÉDIO
* **Arquivo / Recurso:** `src/services/authService.js`, `database.rules.json`
* **Descrição:** Usuários normais poderiam enviar alterações em seu documento de usuário contendo `"role": "admin"`.
* **Impacto:** Um usuário comum poderia elevar-se a administrador do sistema.
* **Correção:** Regras de segurança no Realtime Database e Firestore proíbem explicitamente a modificação do campo `role` para `admin` por usuários normais (`newData.child('role').val() != 'admin'`).
* **Status:** Resolvido

---

### [SEC-08] Alerta de Segurança em Dependência Transitiva (`@grpc/grpc-js`)
* **Severidade:** MÉDIO
* **Arquivo / Recurso:** `package-lock.json`
* **Descrição:** O utilitário `npm audit` reportou vulnerabilidade moderada em `@grpc/grpc-js` (usado internamente pela camada legada do Firestore).
* **Impacto:** Risco potencial em ambientes Node.js com HTTP/2 desprotegido. Na aplicação web (browser), o Firebase SDK utiliza WebSockets e REST (HTTPS), reduzindo a superfície de exposição.
* **Mitigação:** Dependências primárias atualizadas para as versões mais recentes compatíveis; dependência isolada no cliente.
* **Status:** Mitigado

---

### [SEC-09] Persistência de Dados Sensíveis e Ausência de Logout no Cliente
* **Severidade:** MÉDIO
* **Arquivo / Recurso:** `src/services/authService.js`, `src/services/storageService.js`
* **Descrição:** A aplicação não possuía chaveamento claro de sessões nem suporte a logout seguro desconectando o Firebase Auth.
* **Impacto:** Sessões ficavam ativas indefinidamente em navegadores compartilhados em quiosques de produção.
* **Correção:** Implementado sistema formal de login/logout em `authService.js`, limpando dados de sessão e desconectando o SDK do Firebase Authentication via `signOut()`.
* **Status:** Resolvido

---

### [SEC-10] Manipulação da URL e Estado para Acesso à Aba Configurações
* **Severidade:** BAIXO
* **Arquivo / Recurso:** `src/App.jsx`
* **Descrição:** Usuários normais podiam forçar `activeTab = 'settings'` via console ou modificação de estado React.
* **Impacto:** Exibição da interface de configurações para usuários sem perfil administrativo.
* **Correção:** Criada guarda funcional `handleSelectTab` e estado derivado `effectiveTab` que redireciona automaticamente para o Dashboard com notificação de "Acesso Negado".
* **Status:** Resolvido

---

### [SEC-11] Falta de Cabeçalhos Anti-MIME-Sniffing
* **Severidade:** BAIXO
* **Arquivo / Recurso:** `index.html`
* **Descrição:** Ausência de `X-Content-Type-Options: nosniff`.
* **Correção:** Inserida a meta tag `http-equiv="X-Content-Type-Options" content="nosniff"`.
* **Status:** Resolvido

---

### [SEC-12] Referrer Expondo Parâmetros de Navegação
* **Severidade:** BAIXO
* **Arquivo / Recurso:** `index.html`
* **Descrição:** Ausência de especificação de política de referência.
* **Correção:** Inserida meta tag `name="referrer" content="strict-origin-when-cross-origin"`.
* **Status:** Resolvido

---

### [SEC-13] Exposição da Firebase Web API Key
* **Severidade:** INFORMATIVO
* **Arquivo / Recurso:** `src/firebaseConfig.js`
* **Descrição:** A chave de API do Firebase está presente no cliente para conexão do SDK web.
* **Avaliação de Risco:** Falso positivo comum em auditorias automatizadas. No Firebase, a Web API Key serve para identificar o projeto e não para conceder privilégios administrativos. A segurança depende estritamente das Security Rules do Firebase Authentication e Database.
* **Mitigação:** Suporte a variáveis de ambiente via `import.meta.env` e `process.env`.
* **Status:** Arquitetura Validada

---

### [SEC-14] Auditoria de Armazenamento Local (`localStorage`)
* **Severidade:** INFORMATIVO
* **Arquivo / Recurso:** `localStorage`
* **Descrição:** O sistema utiliza `localStorage` para preferências visuais (tema claro/escuro) e cache offline das escalas.
* **Avaliação:** Nenhuma credencial privada, secret de serviço ou token de acesso de backend é persistido em texto claro no `localStorage`.
* **Status:** Em conformidade com as boas práticas

---

## 5. Fechamento da Vulnerabilidade Crítica do Firebase em Produção

* **Data e Hora do Deploy:** 01/10/2026 às 23:31:43 BRT
* **Projeto Firebase:** `rodizio-almoco-equipe`
* **Realtime Database:** `rodizio-almoco-equipe-default-rtdb`
* **Status do Deploy:** Deploy concluído com sucesso via Firebase CLI oficial (`v15.32.1`).
* **Verificação Remota via REST:**
  - `GET /.json`: HTTP 401 Permission Denied (Vulnerabilidade de leitura fechada).
  - `GET /scadahub_settings.json`: HTTP 401 Permission Denied (Vulnerabilidade de configurações fechada).
  - `PUT /pentest_live_check.json`: HTTP 401 Permission Denied (Vulnerabilidade de escrita arbitrária fechada).
* **Testes de Regressão Automatizados:**
  - `npm test`: 16/16 aprovados.
  - `npm run lint`: 0 erros.
  - `npm run build`: Sucesso (dist/ compilado com sucesso).
* **Classificação Final:** **SISTEMA VALIDADO E PROTEGIDO EM PRODUÇÃO**.

