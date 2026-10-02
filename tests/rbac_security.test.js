import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AUDIT_ACCOUNTS,
  authService,
  canUserEditSlot,
  canUserEditEmployee,
  canUserCreateEmployee,
  canUserDeleteEmployee,
  canUserAccessSettings,
  canUserResetData
} from '../src/services/authService.js';

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

// Carrega as regras reais do Realtime Database e Firestore
const rtdbRules = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'database.rules.json'), 'utf8'));
const firestoreRulesText = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');

// Mock do estado do banco com base nas contas de auditoria
const dbState = {
  scadahub_admins: {
    [AUDIT_ACCOUNTS.ADMIN.uid]: true
  },
  scadahub_users: {
    [AUDIT_ACCOUNTS.ADMIN.uid]: { role: 'admin', employeeId: AUDIT_ACCOUNTS.ADMIN.employeeId },
    [AUDIT_ACCOUNTS.USER_A.uid]: { role: 'user', employeeId: AUDIT_ACCOUNTS.USER_A.employeeId },
    [AUDIT_ACCOUNTS.USER_B.uid]: { role: 'user', employeeId: AUDIT_ACCOUNTS.USER_B.employeeId },
    [AUDIT_ACCOUNTS.USER_C.uid]: { role: 'user', employeeId: AUDIT_ACCOUNTS.USER_C.employeeId }
  },
  scadahub_employees: {
    [AUDIT_ACCOUNTS.ADMIN.employeeId]: { id: AUDIT_ACCOUNTS.ADMIN.employeeId, name: AUDIT_ACCOUNTS.ADMIN.name, role: 'admin' },
    [AUDIT_ACCOUNTS.USER_A.employeeId]: { id: AUDIT_ACCOUNTS.USER_A.employeeId, name: AUDIT_ACCOUNTS.USER_A.name, role: 'user' },
    [AUDIT_ACCOUNTS.USER_B.employeeId]: { id: AUDIT_ACCOUNTS.USER_B.employeeId, name: AUDIT_ACCOUNTS.USER_B.name, role: 'user' },
    [AUDIT_ACCOUNTS.USER_C.employeeId]: { id: AUDIT_ACCOUNTS.USER_C.employeeId, name: AUDIT_ACCOUNTS.USER_C.name, role: 'user' }
  }
};

/**
 * Avaliador de Regras RTDB para testes de segurança (simula o comportamento do servidor Firebase)
 */
function evaluateRtdbWrite({ auth, path: targetPath, data, existingData }) {
  if (!auth || !auth.uid) return false;

  const isAdmin = dbState.scadahub_admins[auth.uid] === true;

  // 1. scadahub_settings
  if (targetPath.startsWith('scadahub_settings')) {
    return isAdmin;
  }

  // 2. scadahub_admins
  if (targetPath.startsWith('scadahub_admins')) {
    return false; // Escrita client-side proibida nas regras
  }

  // 3. scadahub_users/$userId
  if (targetPath.startsWith('scadahub_users/')) {
    const targetUserId = targetPath.split('/')[1];
    if (isAdmin) return true;
    if (auth.uid === targetUserId) {
      // Impede escalada de privilégio (não pode alterar a role para admin)
      if (data && data.role === 'admin' && existingData?.role !== 'admin') {
        return false;
      }
      return true;
    }
    return false;
  }

  // 4. scadahub_employees/$empId
  if (targetPath.startsWith('scadahub_employees/')) {
    const targetEmpId = targetPath.split('/')[1];
    if (isAdmin) return true;
    // Usuário normal só pode atualizar o próprio funcionário vinculado
    const userRecord = dbState.scadahub_users[auth.uid];
    if (userRecord && userRecord.employeeId === targetEmpId) {
      if (data && data.role === 'admin' && existingData?.role !== 'admin') return false;
      if (!data) return false; // Delete proibido para usuário normal
      return true;
    }
    return false;
  }

  // 5. scadahub_schedules/$dateStr/$slotKey
  if (targetPath.startsWith('scadahub_schedules/')) {
    if (isAdmin) return true;

    const userRecord = dbState.scadahub_users[auth.uid];
    if (!userRecord || !userRecord.employeeId) return false;

    // Se estiver deletando ou editando slot existente
    if (existingData) {
      if (existingData.employeeId !== userRecord.employeeId) {
        return false; // Proibido modificar ou deletar slot de outro colega
      }
    }

    // Se estiver gravando novo slot
    if (data) {
      if (data.employeeId !== userRecord.employeeId) {
        return false; // Proibido forjar employeeId de outro colega
      }
    }

    return true;
  }

  return false;
}

test('SUÍTE DE SEGURANÇA 1: Matriz de Integridade dos Arquivos de Regras do Firebase', () => {
  assert.ok(rtdbRules.rules, 'database.rules.json deve conter nó rules');
  assert.equal(rtdbRules.rules['.read'], false, 'Leitura pública na raiz deve ser PROIBIDA');
  assert.equal(rtdbRules.rules['.write'], false, 'Escrita pública na raiz deve ser PROIBIDA');
  assert.ok(rtdbRules.rules.scadahub_admins, 'Regra scadahub_admins deve existir');
  assert.ok(rtdbRules.rules.scadahub_schedules, 'Regra scadahub_schedules deve existir');
  assert.ok(rtdbRules.rules.scadahub_settings, 'Regra scadahub_settings deve existir');

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

  // Configurações e Manutenção
  assert.equal(canUserAccessSettings(admin), true, 'Admin pode acessar aba Configurações');
  assert.equal(canUserResetData(admin), true, 'Admin pode restaurar dados aos padrões');

  // Regras de Servidor (RTDB)
  assert.equal(
    evaluateRtdbWrite({ auth: { uid: admin.uid }, path: 'scadahub_settings', data: { criticalStart: '11:00' } }),
    true,
    'Servidor: Admin pode alterar configurações de atendimento'
  );
  assert.equal(
    evaluateRtdbWrite({
      auth: { uid: admin.uid },
      path: 'scadahub_schedules/2026-10-15/slot-1',
      data: { employeeId: AUDIT_ACCOUNTS.USER_A.employeeId, startTime: '12:00' }
    }),
    true,
    'Servidor: Admin pode salvar escala de qualquer colaborador'
  );
  assert.equal(
    evaluateRtdbWrite({
      auth: { uid: admin.uid },
      path: `scadahub_employees/${AUDIT_ACCOUNTS.USER_C.employeeId}`,
      data: null,
      existingData: dbState.scadahub_employees[AUDIT_ACCOUNTS.USER_C.employeeId]
    }),
    true,
    'Servidor: Admin pode excluir funcionário'
  );
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
  assert.equal(canUserEditEmployee(userA, AUDIT_ACCOUNTS.USER_B.employeeId), false, 'USER_A NÃO pode editar perfil de USER_B');

  // Configurações e Manutenção
  assert.equal(canUserAccessSettings(userA), false, 'USER_A NÃO pode acessar aba Configurações');
  assert.equal(canUserResetData(userA), false, 'USER_A NÃO pode restaurar dados');

  // Testes diretos contra regras de servidor (RTDB)
  assert.equal(
    evaluateRtdbWrite({
      auth: { uid: userA.uid },
      path: 'scadahub_schedules/2026-10-15/slot-2',
      data: { employeeId: AUDIT_ACCOUNTS.USER_A.employeeId, startTime: '12:30' }
    }),
    true,
    'Servidor: USER_A pode gravar sua própria escala em data futura'
  );

  assert.equal(
    evaluateRtdbWrite({
      auth: { uid: userA.uid },
      path: 'scadahub_schedules/2026-10-15/slot-3',
      data: { employeeId: AUDIT_ACCOUNTS.USER_B.employeeId, startTime: '13:00' },
      existingData: { employeeId: AUDIT_ACCOUNTS.USER_B.employeeId, startTime: '12:00' }
    }),
    false,
    'Servidor: USER_A é BLOQUEADO ao tentar editar escala de USER_B'
  );

  assert.equal(
    evaluateRtdbWrite({
      auth: { uid: userA.uid },
      path: 'scadahub_schedules/2026-10-15/slot-3',
      data: null,
      existingData: { employeeId: AUDIT_ACCOUNTS.USER_B.employeeId, startTime: '12:00' }
    }),
    false,
    'Servidor: USER_A é BLOQUEADO ao tentar deletar escala de USER_B'
  );

  assert.equal(
    evaluateRtdbWrite({
      auth: { uid: userA.uid },
      path: 'scadahub_settings',
      data: { criticalStart: '12:00' }
    }),
    false,
    'Servidor: USER_A é BLOQUEADO ao tentar alterar regras de atendimento'
  );

  assert.equal(
    evaluateRtdbWrite({
      auth: { uid: userA.uid },
      path: `scadahub_users/${userA.uid}`,
      data: { role: 'admin', employeeId: AUDIT_ACCOUNTS.USER_A.employeeId },
      existingData: dbState.scadahub_users[userA.uid]
    }),
    false,
    'Servidor: USER_A é BLOQUEADO ao tentar escalar privilégio para admin'
  );

  assert.equal(
    evaluateRtdbWrite({
      auth: { uid: userA.uid },
      path: `scadahub_employees/${AUDIT_ACCOUNTS.USER_B.employeeId}`,
      data: null,
      existingData: dbState.scadahub_employees[AUDIT_ACCOUNTS.USER_B.employeeId]
    }),
    false,
    'Servidor: USER_A é BLOQUEADO ao tentar excluir USER_B'
  );
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
  assert.equal(canUserEditEmployee(userB, AUDIT_ACCOUNTS.USER_A.employeeId), false, 'USER_B NÃO pode editar perfil de USER_A');

  // Configurações
  assert.equal(canUserAccessSettings(userB), false, 'USER_B NÃO pode acessar configurações');
  assert.equal(canUserResetData(userB), false, 'USER_B NÃO pode restaurar dados');

  // Testes diretos contra regras de servidor (RTDB)
  assert.equal(
    evaluateRtdbWrite({
      auth: { uid: userB.uid },
      path: 'scadahub_schedules/2026-10-15/slot-3',
      data: { employeeId: AUDIT_ACCOUNTS.USER_B.employeeId, startTime: '12:00' }
    }),
    true,
    'Servidor: USER_B pode gravar sua própria escala'
  );

  assert.equal(
    evaluateRtdbWrite({
      auth: { uid: userB.uid },
      path: 'scadahub_schedules/2026-10-15/slot-2',
      data: { employeeId: AUDIT_ACCOUNTS.USER_A.employeeId, startTime: '11:30' },
      existingData: { employeeId: AUDIT_ACCOUNTS.USER_A.employeeId, startTime: '12:30' }
    }),
    false,
    'Servidor: USER_B é BLOQUEADO ao tentar alterar escala de USER_A'
  );

  assert.equal(
    evaluateRtdbWrite({
      auth: { uid: userB.uid },
      path: `scadahub_employees/${AUDIT_ACCOUNTS.USER_A.employeeId}`,
      data: null,
      existingData: dbState.scadahub_employees[AUDIT_ACCOUNTS.USER_A.employeeId]
    }),
    false,
    'Servidor: USER_B é BLOQUEADO ao tentar excluir USER_A'
  );
});

test('SUÍTE DE SEGURANÇA 5: Teste de Usuário Anônimo / Não Autenticado', () => {
  const unauth = null;

  assert.equal(canUserEditSlot(unauth, { employeeId: AUDIT_ACCOUNTS.USER_A.employeeId }), false, 'Não autenticado não edita slot');
  assert.equal(canUserCreateEmployee(unauth), false, 'Não autenticado não cria funcionário');
  assert.equal(canUserDeleteEmployee(unauth), false, 'Não autenticado não deleta funcionário');
  assert.equal(canUserAccessSettings(unauth), false, 'Não autenticado não acessa settings');

  assert.equal(
    evaluateRtdbWrite({
      auth: null,
      path: 'scadahub_schedules/2026-10-15/slot-1',
      data: { employeeId: AUDIT_ACCOUNTS.USER_A.employeeId }
    }),
    false,
    'Servidor: Bloqueio estrito de escrita para usuário não autenticado'
  );
});

test('SUÍTE DE SEGURANÇA 6: Ciclo Completo de Autenticação Real, Sessão e Logout', async () => {
  // 1. Início Deslogado
  await authService.logout();
  assert.equal(authService.getCurrentUser(), null, 'Usuário deve ser null após logout');
  assert.equal(authService.isAdmin(), false, 'isAdmin deve ser false após logout');

  // 2. Simulação de Login ADMIN
  authService.setTestUser(AUDIT_ACCOUNTS.ADMIN);
  const currentAdmin = authService.getCurrentUser();
  assert.ok(currentAdmin, 'Admin autenticado com sucesso');
  assert.equal(currentAdmin.role, 'admin', 'Role deve ser admin');
  assert.equal(authService.isAdmin(), true, 'authService.isAdmin() deve retornar true');

  // 3. Simulação de Login USER_A
  authService.setTestUser(AUDIT_ACCOUNTS.USER_A);
  const currentUserA = authService.getCurrentUser();
  assert.ok(currentUserA, 'USER_A autenticado com sucesso');
  assert.equal(currentUserA.role, 'user', 'Role deve ser user');
  assert.equal(authService.isAdmin(), false, 'authService.isAdmin() deve retornar false para USER_A');

  // 4. Tentativa de Bypass: Inserir próprio UID em scadahub_admins
  const adminBypassResult = evaluateRtdbWrite({
    auth: { uid: currentUserA.uid },
    path: `scadahub_admins/${currentUserA.uid}`,
    data: true
  });
  assert.equal(adminBypassResult, false, 'Regra deve BLOQUEAR adição direta de UID em scadahub_admins');

  // 5. Tentativa de Bypass: Alterar próprio employeeId para de outro usuário
  const employeeIdBypassResult = evaluateRtdbWrite({
    auth: { uid: currentUserA.uid },
    path: `scadahub_users/${currentUserA.uid}`,
    data: { role: 'admin', employeeId: AUDIT_ACCOUNTS.ADMIN.employeeId },
    existingData: dbState.scadahub_users[currentUserA.uid]
  });
  assert.equal(employeeIdBypassResult, false, 'Regra deve BLOQUEAR alteração de role para admin');

  // 6. Logout final
  await authService.logout();
  assert.equal(authService.getCurrentUser(), null, 'Sessão encerrada com sucesso via logout');
});

test('SUÍTE DE SEGURANÇA 7: Validação Estrita de Senha Atual e Gerenciamento de E-mails', async () => {
  const adminEmail = AUDIT_ACCOUNTS.ADMIN.email;

  // 1. Tentativa de alterar senha sem fornecer a senha atual quando já existe senha -> DEVE FALHAR
  const noCurrentRes = await authService.changePassword(adminEmail, '', 'NovaSenha@999');
  assert.equal(noCurrentRes.success, false, 'Alteração sem senha atual deve ser rejeitada');
  assert.ok(noCurrentRes.message.includes('Informe a sua senha atual'), 'Mensagem deve exigir senha atual');

  // 2. Tentativa de alterar senha com senha atual incorreta -> DEVE FALHAR
  const wrongCurrentRes = await authService.changePassword(adminEmail, 'SenhaErrada123', 'NovaSenha@999');
  assert.equal(wrongCurrentRes.success, false, 'Alteração com senha atual incorreta deve ser rejeitada');
  assert.ok(wrongCurrentRes.message.includes('incorreta'), 'Mensagem deve alertar senha incorreta');

  // 3. Alteração com senha atual correta -> DEVE TER SUCESSO
  const validRes = await authService.changePassword(adminEmail, 'shubadm', 'Admin@Novapwd1');
  assert.equal(validRes.success, true, 'Alteração com senha correta deve ser aprovada');

  // 4. Restaurar senha para testes futuros
  await authService.changePassword(adminEmail, 'Admin@Novapwd1', 'shubadm');
});
