import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkAttendanceCoverage,
  detectConflicts,
  findNextAvailableSlot,
  generateAutoSchedule
} from '../src/utils/scheduler.js';

// Mock de colaboradores para os testes
const mockEmployees = [
  { id: 'emp-1', name: 'Mateus Oliveira', active: true },
  { id: 'emp-2', name: 'Mateus Augusto', active: true },
  { id: 'emp-3', name: 'Monique Hileshein', active: true },
  { id: 'emp-4', name: 'Samara Ravoredo', active: true }
];

const defaultSettings = {
  startHour: '11:00',
  endHour: '14:00',
  criticalStart: '11:30',
  criticalEnd: '13:30',
  minWorkingDuringCritical: 1,
  defaultDuration: 30
};

test('1. Janela crítica completamente coberta (100% de cobertura)', () => {
  // 4 colaboradores ativos, 2 almoçam 11:30-12:00, 2 almoçam 12:30-13:00.
  // Em todo momento entre 11:30 e 13:30, pelo menos 2 colaboradores estão trabalhando.
  const slots = [
    { id: 's1', employeeId: 'emp-1', startTime: '11:30', endTime: '12:00' },
    { id: 's2', employeeId: 'emp-2', startTime: '11:30', endTime: '12:00' },
    { id: 's3', employeeId: 'emp-3', startTime: '12:30', endTime: '13:00' },
    { id: 's4', employeeId: 'emp-4', startTime: '12:30', endTime: '13:00' }
  ];

  const report = checkAttendanceCoverage(mockEmployees, slots, defaultSettings);

  assert.equal(report.isFullyCovered, true);
  assert.equal(report.hasGaps, false);
  assert.equal(report.gaps.length, 0);
  assert.equal(report.coveragePercent, 100);
  assert.ok(report.minWorkersOnDuty >= 1);
});

test('2. Janela crítica parcialmente coberta (detecta gap e calcula porcentagem correta)', () => {
  // Apenas 2 colaboradores: emp-1 e emp-2.
  // emp-1 almoça 11:30 - 12:30 (60 min)
  // emp-2 almoça 12:00 - 13:00 (60 min)
  // Das 12:00 às 12:30 (30 minutos), AMBOS estão em almoço -> ZERO pessoas trabalhando!
  const twoEmployees = mockEmployees.slice(0, 2);
  const slots = [
    { id: 's1', employeeId: 'emp-1', startTime: '11:30', endTime: '12:30' },
    { id: 's2', employeeId: 'emp-2', startTime: '12:00', endTime: '13:00' }
  ];

  const report = checkAttendanceCoverage(twoEmployees, slots, defaultSettings);

  assert.equal(report.isFullyCovered, false);
  assert.equal(report.hasGaps, true);
  assert.equal(report.gaps.length, 1);
  assert.equal(report.gaps[0].startTime, '12:00');
  assert.equal(report.gaps[0].endTime, '12:30');
  assert.equal(report.gaps[0].duration, 30);
  assert.equal(report.gaps[0].workingCount, 0);
  // Total da janela: 120 min. Sem cobertura: 30 min. Cobertura: (120-30)/120 = 75%
  assert.equal(report.coveragePercent, 75);
});

test('3. Janela crítica completamente descoberta (todos em almoço o tempo todo)', () => {
  // Todos os 4 colaboradores saem para almoçar das 11:30 às 13:30 simultaneamente!
  const slots = mockEmployees.map((e) => ({
    id: `s-${e.id}`,
    employeeId: e.id,
    startTime: '11:30',
    endTime: '13:30'
  }));

  const report = checkAttendanceCoverage(mockEmployees, slots, defaultSettings);

  assert.equal(report.isFullyCovered, false);
  assert.equal(report.coveragePercent, 0);
  assert.equal(report.gaps.length, 1);
  assert.equal(report.gaps[0].startTime, '11:30');
  assert.equal(report.gaps[0].endTime, '13:30');
  assert.equal(report.gaps[0].duration, 120);
});

test('4. Gap de poucos minutos dentro da janela crítica (ex: gap de 5 min ou 1 min)', () => {
  // Apenas 1 colaborador na equipe (minRequiredWorkers = 1).
  // Janela crítica: 12:00 às 13:00.
  // Colaborador sai para almoço das 12:20 às 12:25 (5 minutos).
  const oneEmployee = [mockEmployees[0]];
  const customSettings = {
    ...defaultSettings,
    criticalStart: '12:00',
    criticalEnd: '13:00',
    minWorkingDuringCritical: 1
  };
  const slots = [
    { id: 's1', employeeId: 'emp-1', startTime: '12:20', endTime: '12:25' }
  ];

  const report = checkAttendanceCoverage(oneEmployee, slots, customSettings);

  assert.equal(report.hasGaps, true);
  assert.equal(report.gaps.length, 1);
  assert.equal(report.gaps[0].startTime, '12:20');
  assert.equal(report.gaps[0].endTime, '12:25');
  assert.equal(report.gaps[0].duration, 5);
});

test('5. Dois colaboradores cobrindo partes diferentes da mesma janela crítica', () => {
  // 2 colaboradores ativos. Janela crítica: 11:30 às 13:30.
  // emp-1 almoça 11:30 às 12:30 (emp-2 cobre das 11:30 às 12:30)
  // emp-2 almoça 12:30 às 13:30 (emp-1 cobre das 12:30 às 13:30)
  // Limite exato às 12:30: emp-1 volta às 12:30 e emp-2 sai às 12:30.
  // Não deve haver gap no minuto 12:30!
  const twoEmployees = mockEmployees.slice(0, 2);
  const slots = [
    { id: 's1', employeeId: 'emp-1', startTime: '11:30', endTime: '12:30' },
    { id: 's2', employeeId: 'emp-2', startTime: '12:30', endTime: '13:30' }
  ];

  const report = checkAttendanceCoverage(twoEmployees, slots, defaultSettings);

  assert.equal(report.isFullyCovered, true, 'Transição exata no minuto 12:30 não deve gerar gap');
  assert.equal(report.hasGaps, false);
  assert.equal(report.coveragePercent, 100);
});

test('6. Um único colaborador cobrindo toda a janela crítica (almoço fora da janela)', () => {
  // Apenas 1 colaborador na equipe (minRequired = 1).
  // Janela crítica: 12:00 às 13:00. Janela de almoço geral: 11:00 às 14:00.
  // O colaborador almoça das 11:30 às 12:00 (antes da janela crítica).
  // Durante as 12:00 às 13:00, ele está 100% presente no posto de atendimento.
  const oneEmployee = [mockEmployees[0]];
  const customSettings = {
    ...defaultSettings,
    criticalStart: '12:00',
    criticalEnd: '13:00',
    minWorkingDuringCritical: 1
  };
  const slots = [
    { id: 's1', employeeId: 'emp-1', startTime: '11:30', endTime: '12:00' }
  ];

  const report = checkAttendanceCoverage(oneEmployee, slots, customSettings);

  assert.equal(report.isFullyCovered, true);
  assert.equal(report.hasGaps, false);
  assert.equal(report.coveragePercent, 100);
});

test('7. Impossibilidade de cobertura detectada pelo gerador', () => {
  // Exemplo: exigência de 2 atendentes trabalhando durante a janela crítica,
  // mas a equipe só possui 1 colaborador ativo!
  const oneEmployee = [mockEmployees[0]];
  const impossibleSettings = {
    ...defaultSettings,
    minWorkingDuringCritical: 2
  };

  const generated = generateAutoSchedule({
    employees: oneEmployee,
    date: '2026-10-01',
    settings: impossibleSettings
  });

  assert.equal(generated.success, false);
  assert.ok(generated.error.includes('Equipe insuficiente'));
  assert.equal(generated.length, 0);
});

test('8. Escala gerada automaticamente garante cobertura total da janela crítica', () => {
  // Teste com equipe padrão de 4 pessoas, janela crítica 11:30 às 13:30, duração de 30 min.
  const generated = generateAutoSchedule({
    employees: mockEmployees,
    date: '2026-10-01',
    settings: defaultSettings,
    rotationIndex: 0
  });

  assert.equal(generated.success, true);
  assert.equal(generated.length, 4, 'Todos os 4 colaboradores devem ter slot alocado');

  const coverage = checkAttendanceCoverage(mockEmployees, generated, defaultSettings);
  assert.equal(coverage.isFullyCovered, true, 'A escala gerada pelo algoritmo DEVE ser 100% coberta');
  assert.equal(coverage.hasGaps, false);
  assert.equal(coverage.coveragePercent, 100);
});

test('9. Escala gerada para janela crítica personalizada (12:00 às 13:00)', () => {
  // Como na Imagem 5: Janela crítica 12:00 às 13:00.
  const customSettings = {
    ...defaultSettings,
    criticalStart: '12:00',
    criticalEnd: '13:00',
    minWorkingDuringCritical: 1,
    defaultDuration: 30
  };

  const generated = generateAutoSchedule({
    employees: mockEmployees,
    date: '2026-10-01',
    settings: customSettings,
    rotationIndex: 2
  });

  assert.equal(generated.success, true);
  const coverage = checkAttendanceCoverage(mockEmployees, generated, customSettings);
  assert.equal(coverage.isFullyCovered, true);
  assert.equal(coverage.coveragePercent, 100);
});

test('10. Detecção de conflito em horários sobrepostos do mesmo colaborador', () => {
  const slots = [
    { id: 's1', employeeId: 'emp-1', startTime: '11:30', endTime: '12:00' },
    { id: 's2', employeeId: 'emp-1', startTime: '11:45', endTime: '12:15' } // Sobrepõe com s1!
  ];

  const report = detectConflicts(slots, defaultSettings, mockEmployees);
  assert.equal(report.hasConflicts, true);
  assert.ok(report.conflictDetails.some((d) => d.type === 'SELF_OVERLAP'));
});

test('11. Validação de limites de duração de almoço (mínimo 30m e máximo 2 horas / 120m)', () => {
  const MIN_LUNCH_MINUTES = 30;
  const MAX_LUNCH_MINUTES = 120;

  const validateLunchDuration = (startTime, endTime) => {
    const [sH, sM] = startTime.split(':').map(Number);
    const [eH, eM] = endTime.split(':').map(Number);
    const duration = (eH * 60 + eM) - (sH * 60 + sM);
    if (duration <= 0) return { valid: false, error: 'Horário de término deve ser posterior ao início' };
    if (duration < MIN_LUNCH_MINUTES) return { valid: false, error: 'Mínimo de 30 minutos' };
    if (duration > MAX_LUNCH_MINUTES) return { valid: false, error: 'Máximo de 2 horas (120 minutos)' };
    return { valid: true, duration };
  };

  // Casos inválidos (menor que 30 min)
  assert.equal(validateLunchDuration('12:00', '12:20').valid, false); // 20 min (antigo preset)
  assert.equal(validateLunchDuration('12:00', '12:29').valid, false); // 29 min
  assert.equal(validateLunchDuration('12:00', '12:00').valid, false); // 0 min

  // Casos inválidos (maior que 120 min / 2 horas)
  assert.equal(validateLunchDuration('11:00', '13:01').valid, false); // 121 min
  assert.equal(validateLunchDuration('11:00', '14:00').valid, false); // 180 min (3 horas)

  // Casos válidos (entre 30 min e 120 min)
  assert.equal(validateLunchDuration('12:00', '12:30').valid, true); // 30 min (mínimo exato)
  assert.equal(validateLunchDuration('12:00', '12:45').valid, true); // 45 min
  assert.equal(validateLunchDuration('12:00', '13:00').valid, true); // 60 min (1 hora)
  assert.equal(validateLunchDuration('11:30', '13:00').valid, true); // 90 min (1h30)
  assert.equal(validateLunchDuration('11:00', '13:00').valid, true); // 120 min (máximo exato / 2 horas)
});
