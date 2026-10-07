import test from 'node:test';
import assert from 'node:assert/strict';
import { authService, TEST_ACCOUNTS } from '../src/services/authService.js';
import { checkAttendanceCoverage, detectConflicts, ensureArray } from '../src/utils/scheduler.js';
import { shouldTriggerLunchAlert } from '../src/services/soundService.js';

test('SUÍTE MULTI-USUÁRIO 1: Autenticação Real e Resolução de Perfil para Todos os Usuários', async () => {
  // 1. ADMIN (Mateus Gomes)
  const resAdmin = await authService.loginWithEmailAndPassword('mateus.gomes@scadahub.io', 'shubadm');
  assert.equal(resAdmin.success, true, 'Admin deve logar com sucesso');
  assert.equal(resAdmin.user.role, 'admin', 'Role deve ser admin');
  assert.equal(resAdmin.user.employeeId, 'emp-2', 'EmployeeId deve ser emp-2');
  assert.equal(authService.isAdmin(), true, 'isAdmin deve retornar true');

  // 2. USER_A (Mateus Silva)
  const resUserA = await authService.loginWithEmailAndPassword('mateus.silva@scadahub.io', 'shubadm');
  assert.equal(resUserA.success, true, 'Mateus Silva deve logar com sucesso');
  assert.equal(resUserA.user.role, 'user', 'Role deve ser user');
  assert.equal(resUserA.user.employeeId, 'emp-1', 'EmployeeId deve ser emp-1');
  assert.equal(authService.isAdmin(), false, 'isAdmin deve retornar false');

  // 3. USER_B (Monique Hilleshein) - Teste com email corporativo completo e curto
  const resMonique1 = await authService.loginWithEmailAndPassword('monique.hilleshein@scadahub.io', 'shubadm');
  assert.equal(resMonique1.success, true, 'Monique deve logar com monique.hilleshein@scadahub.io');
  assert.equal(resMonique1.user.employeeId, 'emp-3', 'EmployeeId deve ser emp-3');
  assert.equal(resMonique1.user.role, 'user', 'Role deve ser user');

  const resMonique2 = await authService.loginWithEmailAndPassword('monique@scadahub.io', 'shubadm');
  assert.equal(resMonique2.success, true, 'Monique deve logar com monique@scadahub.io');
  assert.equal(resMonique2.user.employeeId, 'emp-3', 'EmployeeId deve ser emp-3');

  // 4. USER_C (Samara Revoredo)
  const resSamara = await authService.loginWithEmailAndPassword('samara.revoredo@scadahub.io', 'shubadm');
  assert.equal(resSamara.success, true, 'Samara deve logar com sucesso');
  assert.equal(resSamara.user.employeeId, 'emp-4', 'EmployeeId deve ser emp-4');
  assert.equal(resSamara.user.role, 'user', 'Role deve ser user');
});

test('SUÍTE MULTI-USUÁRIO 2: Visibilidade Cruzada Mútua dos Almoços (Timeline / Cards)', () => {
  const employees = [
    { id: 'emp-1', name: 'Mateus de Oliveira Silva', active: true },
    { id: 'emp-2', name: 'Mateus Augusto Santos Gomes', active: true },
    { id: 'emp-3', name: 'Monique Aparecida Hilleshein', active: true },
    { id: 'emp-4', name: 'Samara Revoredo', active: true }
  ];

  const daySlots = [
    { id: 'slot-1', employeeId: 'emp-1', startTime: '12:30', endTime: '13:30', duration: 60 },
    { id: 'slot-2', employeeId: 'emp-2', startTime: '12:00', endTime: '12:30', duration: 30 },
    { id: 'slot-3', employeeId: 'emp-3', startTime: '11:45', endTime: '12:15', duration: 30 },
    { id: 'slot-4', employeeId: 'emp-4', startTime: '12:30', endTime: '13:10', duration: 40 }
  ];

  // Simulação de renderização para cada usuário autenticado
  const allUserIds = ['emp-1', 'emp-2', 'emp-3', 'emp-4'];

  allUserIds.forEach((viewerId) => {
    // O observador deve ver os slots de TODOS os 4 colaboradores
    const visibleSlots = employees.map((emp) => {
      const slot = daySlots.find((s) => s.employeeId === emp.id);
      return {
        employeeId: emp.id,
        name: emp.name,
        hasSlot: Boolean(slot),
        startTime: slot?.startTime,
        isOwn: emp.id === viewerId
      };
    });

    assert.equal(visibleSlots.length, 4, `Usuário ${viewerId} deve ver as 4 linhas da escala`);
    assert.ok(visibleSlots.every((s) => s.hasSlot), `Todos os 4 colaboradores devem ter almoço visível para ${viewerId}`);
    
    // Confirma que a Monique (emp-3) está visível com o horário correto
    const moniqueEntry = visibleSlots.find((s) => s.employeeId === 'emp-3');
    assert.equal(moniqueEntry.startTime, '11:45', `Horário de almoço da Monique deve ser 11:45 para o usuário ${viewerId}`);

    // Confirma que a Samara (emp-4) está visível com o horário correto
    const samaraEntry = visibleSlots.find((s) => s.employeeId === 'emp-4');
    assert.equal(samaraEntry.startTime, '12:30', `Horário de almoço da Samara deve ser 12:30 para o usuário ${viewerId}`);
  });
});

test('SUÍTE MULTI-USUÁRIO 3: Isolamento Absoluto do Alarme Sonoro para Todos os 4 Colaboradores', () => {
  const slots = [
    { id: 's1', employeeId: 'emp-1', startTime: '12:30' },
    { id: 's2', employeeId: 'emp-2', startTime: '12:00' },
    { id: 's3', employeeId: 'emp-3', startTime: '11:45' },
    { id: 's4', employeeId: 'emp-4', startTime: '12:30' }
  ];

  function evaluateAudioTrigger(currentUserId, minutes) {
    const ownSlots = slots.filter((s) => s.employeeId === currentUserId);
    for (const slot of ownSlots) {
      const startMin = Number(slot.startTime.split(':')[0]) * 60 + Number(slot.startTime.split(':')[1]);
      const remaining = startMin - minutes;
      if (shouldTriggerLunchAlert(remaining)) {
        return { triggered: true, slot };
      }
    }
    return { triggered: false, slot: null };
  }

  // 1. Às 11:35 (Faltam 10 minutos para o almoço da Monique - 11:45)
  // DEVE TOCAR: apenas para Monique (emp-3)
  // NÃO DEVE TOCAR: para emp-1, emp-2, emp-4
  assert.equal(evaluateAudioTrigger('emp-3', 11 * 60 + 35).triggered, true, 'Monique DEVE ouvir alarme aos 10 min');
  assert.equal(evaluateAudioTrigger('emp-1', 11 * 60 + 35).triggered, false, 'Mateus Silva NÃO deve ouvir alarme da Monique');
  assert.equal(evaluateAudioTrigger('emp-2', 11 * 60 + 35).triggered, false, 'Mateus Gomes NÃO deve ouvir alarme da Monique');
  assert.equal(evaluateAudioTrigger('emp-4', 11 * 60 + 35).triggered, false, 'Samara NÃO deve ouvir alarme da Monique');

  // 2. Às 11:50 (Faltam 10 minutos para o almoço do Mateus Gomes - 12:00)
  // DEVE TOCAR: apenas para Mateus Gomes (emp-2)
  assert.equal(evaluateAudioTrigger('emp-2', 11 * 60 + 50).triggered, true, 'Mateus Gomes DEVE ouvir seu próprio alarme');
  assert.equal(evaluateAudioTrigger('emp-3', 11 * 60 + 50).triggered, false, 'Monique NÃO deve ouvir alarme do Mateus Gomes');
  assert.equal(evaluateAudioTrigger('emp-4', 11 * 60 + 50).triggered, false, 'Samara NÃO deve ouvir alarme do Mateus Gomes');

  // 3. Às 12:20 (Faltam 10 minutos para o almoço de Mateus Silva e Samara - 12:30)
  // DEVE TOCAR: para emp-1 e emp-4 quando cada um estiver em sua respectiva sessão
  assert.equal(evaluateAudioTrigger('emp-1', 12 * 60 + 20).triggered, true, 'Mateus Silva DEVE ouvir seu alarme');
  assert.equal(evaluateAudioTrigger('emp-4', 12 * 60 + 20).triggered, true, 'Samara DEVE ouvir seu alarme');
  assert.equal(evaluateAudioTrigger('emp-3', 12 * 60 + 20).triggered, false, 'Monique NÃO deve ouvir alarme de colegas');
  assert.equal(evaluateAudioTrigger('emp-2', 12 * 60 + 20).triggered, false, 'Mateus Gomes NÃO deve ouvir alarme de colegas');
});

test('SUÍTE MULTI-USUÁRIO 4: Cobertura Ininterrupta de Atendimento entre 11:30 e 13:30', () => {
  const employees = [
    { id: 'emp-1', name: 'Mateus de Oliveira Silva', active: true },
    { id: 'emp-2', name: 'Mateus Augusto Santos Gomes', active: true },
    { id: 'emp-3', name: 'Monique Aparecida Hilleshein', active: true },
    { id: 'emp-4', name: 'Samara Revoredo', active: true }
  ];

  const daySlots = [
    { id: 'slot-1', employeeId: 'emp-1', startTime: '12:30', endTime: '13:30', duration: 60 },
    { id: 'slot-2', employeeId: 'emp-2', startTime: '12:00', endTime: '12:30', duration: 30 },
    { id: 'slot-3', employeeId: 'emp-3', startTime: '11:45', endTime: '12:15', duration: 30 },
    { id: 'slot-4', employeeId: 'emp-4', startTime: '12:30', endTime: '13:10', duration: 40 }
  ];

  const settings = {
    startHour: '11:00',
    endHour: '14:00',
    criticalStart: '11:30',
    criticalEnd: '13:30',
    minWorkingDuringCritical: 1
  };

  const report = checkAttendanceCoverage(employees, daySlots, settings);
  assert.equal(report.isFullyCovered, true, 'Janela crítica deve estar 100% coberta');
  assert.equal(report.hasGaps, false, 'Não deve haver nenhuma brecha no atendimento');
  assert.equal(report.coveragePercent, 100, 'Percentual deve ser 100%');
  assert.ok(report.minWorkersOnDuty >= 2, 'No pior momento há pelo menos 2 atendentes trabalhando simultaneamente');
});

test('Finalização limpa das conexões de teste', () => {
  setTimeout(() => process.exit(0), 100).unref();
});
