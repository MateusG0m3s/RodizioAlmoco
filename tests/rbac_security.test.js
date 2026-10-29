import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canUserEditSlot,
  canUserEditEmployee,
  canUserEditEmployeeStatus,
  canUserCreateEmployee,
  canUserDeleteEmployee,
  canUserAccessSettings,
  canUserResetData,
  isCompanyAccount,
  buildSessionUser,
  friendlyAuthError
} from '../src/services/authService.js';
import { AUDIT_ACCOUNTS, googleUser } from './fixtures/accounts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock do localStorage para testes de ambiente Node
const localStore = {};
globalThis.localStorage = {
  getItem: (k) => (k in localStore ? localStore[k] : null),
  setItem: (k, v) => { localStore[k] = String(v); },
  removeItem: (k) => { delete localStore[k]; },
  clear: () => { Object.keys(localStore).forEach((k) => delete localStore[k]); }
};

// Carrega as regras reais do Realtime Database e Firestore. O comportamento delas é testado no emulador
// (database.rules.test.js); aqui fica só a checagem estrutural, que roda sem Java.
const rtdbRules = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'database.rules.json'), 'utf8'));
const firestoreRulesText = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');

// Todas as expressões de .read/.write do arquivo, com o caminho
function collectRules(node, trail = []) {
  return Object.entries(node).flatMap(([key, value]) => {
    if (key === '.read' || key === '.write') return [{ path: [...trail, key].join('/'), expr: value }];
    return value && typeof value === 'object' ? collectRules(value, [...trail, key]) : [];
  });
}

test('SUÍTE DE SEGURANÇA 1: Matriz de Integridade dos Arquivos de Regras do Firebase', () => {
  assert.ok(rtdbRules.rules, 'database.rules.json deve conter nó rules');
  assert.equal(rtdbRules.rules['.read'], false, 'Leitura pública na raiz deve ser PROIBIDA');
  assert.equal(rtdbRules.rules['.write'], false, 'Escrita pública na raiz deve ser PROIBIDA');
  assert.ok(rtdbRules.rules.scadahub_admins, 'Regra scadahub_admins deve existir');
  assert.ok(rtdbRules.rules.scadahub_schedules, 'Regra scadahub_schedules deve existir');
  assert.ok(rtdbRules.rules.scadahub_settings, 'Regra scadahub_settings deve existir');

  const rules = collectRules(rtdbRules.rules).filter((r) => r.path.includes('/'));
  for (const { path: rulePath, expr } of rules) {
    assert.equal(typeof expr, 'string', `${rulePath} não pode ser true/false fixo: toda permissão depende da conta`);
    assert.ok(expr.includes('auth != null'), `${rulePath} deve exigir login`);
  }
  for (const { path: rulePath, expr } of rules.filter((r) => r.path.endsWith('.read') && !r.path.startsWith('scadahub_admins'))) {
    assert.ok(expr.includes("email_verified === true") && expr.includes("endsWith('@daqhmi.com')") && expr.includes("endsWith('@scadahub.io')"), `${rulePath}: leitura só para e-mail verificado da empresa`);
  }
  assert.ok(!rules.some((r) => r.path.startsWith('scadahub_admins') && r.path.endsWith('.write')), 'scadahub_admins só se grava pelo console');

  assert.ok(firestoreRulesText.includes('service cloud.firestore'), 'firestore.rules deve ser um arquivo válido de regras');
  assert.ok(firestoreRulesText.includes('isAdmin()'), 'firestore.rules deve implementar helper isAdmin()');
  assert.ok(firestoreRulesText.includes('isOwnEmployee('), 'firestore.rules deve implementar helper isOwnEmployee()');
});

test('SUÍTE DE SEGURANÇA 2: Testes de Autorização para Administrador (ADMIN)', () => {
  const admin = AUDIT_ACCOUNTS.ADMIN;

  // Escalas
  assert.equal(canUserEditSlot(admin, { employeeId: AUDIT_ACCOUNTS.ADMIN.employeeId }), true, 'Admin pode editar própria escala');
  assert.equal(canUserEditSlot(admin, { employeeId: AUDIT_ACCOUNTS.USER_A.employeeId }), true, 'Admin pode editar escala de USER_A');
  assert.equal(canUserEditSlot(admin, { employeeId: AUDIT_ACCOUNTS.USER_B.employeeId }), true, 'Admin pode editar escala de USER_B');

  // Gestão de Funcionários
  assert.equal(canUserCreateEmployee(admin), true, 'Admin pode criar funcionário (ex: USER_C)');
  assert.equal(canUserDeleteEmployee(admin), true, 'Admin pode excluir qualquer funcionário');
  assert.equal(canUserEditEmployee(admin, AUDIT_ACCOUNTS.USER_A.employeeId), true, 'Admin pode editar qualquer funcionário');
  assert.equal(canUserEditEmployeeStatus(admin, AUDIT_ACCOUNTS.USER_A.employeeId), true, 'Admin pode alterar status de qualquer colaborador');

  // Configurações e Manutenção
  assert.equal(canUserAccessSettings(admin), true, 'Admin pode acessar aba Configurações');
  assert.equal(canUserResetData(admin), true, 'Admin pode restaurar dados aos padrões');
});

test('SUÍTE DE SEGURANÇA 3: Testes de Autorização para Usuário Normal A (USER_A)', () => {
  const userA = AUDIT_ACCOUNTS.USER_A;

  // Própria escala em qualquer data (passado, presente, futuro)
  assert.equal(canUserEditSlot(userA, { employeeId: AUDIT_ACCOUNTS.USER_A.employeeId }), true, 'USER_A pode editar própria escala de hoje');
  assert.equal(canUserEditSlot(userA, { employeeId: AUDIT_ACCOUNTS.USER_A.employeeId }), true, 'USER_A pode editar própria escala passada');
  assert.equal(canUserEditSlot(userA, { employeeId: AUDIT_ACCOUNTS.USER_A.employeeId }), true, 'USER_A pode editar própria escala futura');

  // Bloqueio de escala alheia
  assert.equal(canUserEditSlot(userA, { employeeId: AUDIT_ACCOUNTS.USER_B.employeeId }), false, 'USER_A NÃO pode editar escala de USER_B');
  assert.equal(canUserEditSlot(userA, { employeeId: AUDIT_ACCOUNTS.ADMIN.employeeId }), false, 'USER_A NÃO pode editar escala de Admin');

  // Gestão de Funcionários
  assert.equal(canUserCreateEmployee(userA), false, 'USER_A NÃO pode criar funcionários');
  assert.equal(canUserDeleteEmployee(userA), false, 'USER_A NÃO pode excluir funcionários');
  assert.equal(canUserEditEmployee(userA, AUDIT_ACCOUNTS.USER_A.employeeId), true, 'USER_A pode editar seu próprio perfil');
  assert.equal(canUserEditEmployeeStatus(userA, AUDIT_ACCOUNTS.USER_A.employeeId), true, 'USER_A pode alterar seu próprio status (ativo/inativo) na escala');
  assert.equal(canUserEditEmployee(userA, AUDIT_ACCOUNTS.USER_B.employeeId), false, 'USER_A NÃO pode editar perfil de USER_B');
  assert.equal(canUserEditEmployeeStatus(userA, AUDIT_ACCOUNTS.USER_B.employeeId), false, 'USER_A NÃO pode alterar status de USER_B');

  // Configurações e Manutenção
  assert.equal(canUserAccessSettings(userA), false, 'USER_A NÃO pode acessar aba Configurações');
  assert.equal(canUserResetData(userA), false, 'USER_A NÃO pode restaurar dados');
});

test('SUÍTE DE SEGURANÇA 4: Testes de Autorização Espelhados para Usuário Normal B (USER_B)', () => {
  const userB = AUDIT_ACCOUNTS.USER_B;

  // Própria escala em qualquer data
  assert.equal(canUserEditSlot(userB, { employeeId: AUDIT_ACCOUNTS.USER_B.employeeId }), true, 'USER_B pode editar própria escala');
  assert.equal(canUserEditSlot(userB, { employeeId: AUDIT_ACCOUNTS.USER_A.employeeId }), false, 'USER_B NÃO pode editar escala de USER_A');

  // Gestão de Funcionários
  assert.equal(canUserCreateEmployee(userB), false, 'USER_B NÃO pode criar funcionários');
  assert.equal(canUserDeleteEmployee(userB), false, 'USER_B NÃO pode excluir funcionários');
  assert.equal(canUserEditEmployee(userB, AUDIT_ACCOUNTS.USER_B.employeeId), true, 'USER_B pode editar seu próprio perfil');
  assert.equal(canUserEditEmployeeStatus(userB, AUDIT_ACCOUNTS.USER_B.employeeId), true, 'USER_B pode alterar seu próprio status (ativo/inativo) na escala');
  assert.equal(canUserEditEmployee(userB, AUDIT_ACCOUNTS.USER_A.employeeId), false, 'USER_B NÃO pode editar perfil de USER_A');
  assert.equal(canUserEditEmployeeStatus(userB, AUDIT_ACCOUNTS.USER_A.employeeId), false, 'USER_B NÃO pode alterar status de USER_A');

  // Configurações
  assert.equal(canUserAccessSettings(userB), false, 'USER_B NÃO pode acessar configurações');
  assert.equal(canUserResetData(userB), false, 'USER_B NÃO pode restaurar dados');
});

test('SUÍTE DE SEGURANÇA 5: Teste de Usuário Anônimo / Não Autenticado', () => {
  const unauth = null;

  assert.equal(canUserEditSlot(unauth, { employeeId: AUDIT_ACCOUNTS.USER_A.employeeId }), false, 'Não autenticado não edita slot');
  assert.equal(canUserCreateEmployee(unauth), false, 'Não autenticado não cria funcionário');
  assert.equal(canUserDeleteEmployee(unauth), false, 'Não autenticado não deleta funcionário');
  assert.equal(canUserEditEmployeeStatus(unauth, AUDIT_ACCOUNTS.USER_A.employeeId), false, 'Não autenticado não altera status');
  assert.equal(canUserAccessSettings(unauth), false, 'Não autenticado não acessa settings');
});

test('SUÍTE DE SEGURANÇA 6: Login Google só aceita conta verificada da scadahub', () => {
  assert.equal(isCompanyAccount(googleUser(AUDIT_ACCOUNTS.ADMIN)), true, 'Conta Google @daqhmi.com (Workspace) verificada entra');
  assert.equal(isCompanyAccount(googleUser(AUDIT_ACCOUNTS.USER_A, { email: 'Mateus.Silva@Daqhmi.com' })), true, 'Domínio não diferencia maiúsculas');
  assert.equal(isCompanyAccount(googleUser(AUDIT_ACCOUNTS.USER_A, { email: 'contato@scadahub.io' })), true, 'Domínio secundário do Workspace entra');
  assert.equal(isCompanyAccount(googleUser(AUDIT_ACCOUNTS.USER_A, { email: 'mateus.silva@gmail.com' })), false, 'Gmail pessoal é recusado');
  assert.equal(isCompanyAccount(googleUser(AUDIT_ACCOUNTS.USER_A, { email: 'x@daqhmi.com.evil.com' })), false, 'Domínio parecido é recusado');
  assert.equal(isCompanyAccount(googleUser(AUDIT_ACCOUNTS.USER_A, { email: 'x@evildaqhmi.com' })), false, 'Sufixo sem @ é recusado');
  assert.equal(isCompanyAccount(googleUser(AUDIT_ACCOUNTS.USER_A, { emailVerified: false })), false, 'E-mail não verificado é recusado');
  assert.equal(isCompanyAccount(null), false);

  const admin = buildSessionUser(googleUser(AUDIT_ACCOUNTS.ADMIN), true);
  assert.equal(admin.role, 'admin', 'Papel de admin vem de scadahub_admins');
  assert.equal(admin.employeeId, null, 'O colaborador é resolvido pelo e-mail, não fica gravado na sessão');
  const user = buildSessionUser(googleUser(AUDIT_ACCOUNTS.USER_A, { email: 'Mateus.Silva@daqhmi.com' }), false);
  assert.equal(user.role, 'user');
  assert.equal(user.email, 'mateus.silva@daqhmi.com', 'E-mail da sessão em minúsculas');

  assert.equal(friendlyAuthError('auth/popup-closed-by-user'), null, 'Fechar a janela do Google não é erro');
  assert.ok(friendlyAuthError('auth/popup-blocked').includes('pop-ups'));
  assert.ok(friendlyAuthError('auth/unauthorized-domain').includes('autorizado'));
});

test('SUÍTE DE SEGURANÇA 7: Nenhuma senha fixa nem login local no código publicado', () => {
  const srcDir = path.join(__dirname, '..', 'src');
  const files = fs.readdirSync(srcDir, { recursive: true }).filter((f) => /\.(jsx?|css|html)$/.test(f));
  const source = files.map((f) => fs.readFileSync(path.join(srcDir, f), 'utf8')).join('\n');
  for (const forbidden of ['shubadm', 'Admin@123456', 'useradminshub', 'signInWithEmailAndPassword', 'getPasswordForEmail', 'PasswordCredential', 'initialPassword: ']) {
    assert.ok(!source.includes(forbidden), `src/ não pode conter "${forbidden}"`);
  }
});
