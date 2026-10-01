import { timeToMinutes, minutesToTime, addMinutesToTime } from './timeUtils.js';

/**
 * Verifica a cobertura de atendimento aos clientes durante a Janela Crítica.
 *
 * Avalia minuto a minuto se o número de colaboradores ativos trabalhando
 * (isto é, que NÃO estão em horário de almoço no minuto avaliado) atende à
 * exigência mínima definida em settings (minWorkingDuringCritical).
 *
 * Intervalos de almoço são avaliados como semi-abertos: [startTime, endTime),
 * ou seja, o colaborador almoça de startTime até endTime - 1 minuto. No minuto
 * endTime ele já retornou e está ativo no posto de atendimento.
 */
export function checkAttendanceCoverage(employees, slots, settings = {}) {
  const activeEmployees = (employees || []).filter((e) => e.active);
  const totalActiveWorkers = activeEmployees.length;

  const critStartMin = timeToMinutes(settings.criticalStart || '11:30');
  const critEndMin = timeToMinutes(settings.criticalEnd || '13:30');
  const minRequiredWorkers = Number(settings.minWorkingDuringCritical !== undefined ? settings.minWorkingDuringCritical : 1);

  const totalCriticalMinutes = Math.max(0, critEndMin - critStartMin);
  const activeEmpIds = new Set(activeEmployees.map((e) => e.id));

  // Validação de janela crítica inválida ou invertida
  if (totalCriticalMinutes === 0) {
    return {
      isFullyCovered: true,
      hasGaps: false,
      gaps: [],
      coveragePercent: 100,
      minWorkersOnDuty: totalActiveWorkers,
      totalActiveWorkers,
      minRequiredWorkers,
      criticalWindow: `${settings.criticalStart || '11:30'} — ${settings.criticalEnd || '13:30'}`
    };
  }

  // Prepara os intervalos de almoço dos colaboradores ativos
  const activeSlots = (slots || []).filter((s) => activeEmpIds.has(s.employeeId)).map((s) => ({
    id: s.id,
    employeeId: s.employeeId,
    start: timeToMinutes(s.startTime),
    end: timeToMinutes(s.endTime)
  }));

  let minutesWithoutCoverage = 0;
  let minWorkersSeen = totalActiveWorkers;

  const gaps = [];
  let currentGap = null;

  // Avaliação minuto a minuto para garantir que nenhum gap (mesmo de 1 ou 2 min) passe despercebido
  for (let m = critStartMin; m < critEndMin; m += 1) {
    const lunchingEmpIds = new Set();
    for (let i = 0; i < activeSlots.length; i++) {
      const slot = activeSlots[i];
      if (m >= slot.start && m < slot.end) {
        lunchingEmpIds.add(slot.employeeId);
      }
    }

    const workingCount = Math.max(0, totalActiveWorkers - lunchingEmpIds.size);
    if (workingCount < minWorkersSeen) {
      minWorkersSeen = workingCount;
    }

    if (workingCount < minRequiredWorkers) {
      minutesWithoutCoverage += 1;
      if (!currentGap) {
        currentGap = { start: m, end: m + 1, workingCount };
      } else {
        currentGap.end = m + 1;
        currentGap.workingCount = Math.min(currentGap.workingCount, workingCount);
      }
    } else {
      if (currentGap) {
        gaps.push({
          startTime: minutesToTime(currentGap.start),
          endTime: minutesToTime(currentGap.end),
          workingCount: currentGap.workingCount,
          duration: currentGap.end - currentGap.start
        });
        currentGap = null;
      }
    }
  }

  if (currentGap) {
    gaps.push({
      startTime: minutesToTime(currentGap.start),
      endTime: minutesToTime(currentGap.end),
      workingCount: currentGap.workingCount,
      duration: currentGap.end - currentGap.start
    });
  }

  const coveragePercent = Math.max(
    0,
    Math.min(100, Math.round(((totalCriticalMinutes - minutesWithoutCoverage) / totalCriticalMinutes) * 100))
  );

  return {
    isFullyCovered: gaps.length === 0,
    hasGaps: gaps.length > 0,
    gaps,
    coveragePercent,
    minWorkersOnDuty: minWorkersSeen,
    totalActiveWorkers,
    minRequiredWorkers,
    criticalWindow: `${settings.criticalStart || '11:30'} — ${settings.criticalEnd || '13:30'}`
  };
}

/**
 * Detecta conflitos de escala: horários descobertos na janela crítica
 * ou colaboradores com sobreposição de escalas no mesmo dia.
 */
export function detectConflicts(slots = [], settings = {}, employees = []) {
  const coverage = checkAttendanceCoverage(employees, slots, settings);
  const conflictSlots = new Set();
  const conflictDetails = [];

  // 1. Conflito por falta de cobertura na janela crítica
  if (coverage.hasGaps) {
    coverage.gaps.forEach((gap) => {
      const gStart = timeToMinutes(gap.startTime);
      const gEnd = timeToMinutes(gap.endTime);

      slots.forEach((s) => {
        const sStart = timeToMinutes(s.startTime);
        const sEnd = timeToMinutes(s.endTime);
        // Colaboradores que estão em almoço durante o gap contribuem para a falta de atendimento
        if (Math.max(gStart, sStart) < Math.min(gEnd, sEnd)) {
          conflictSlots.add(s.id);
        }
      });

      conflictDetails.push({
        type: 'COVERAGE_GAP',
        message: `⚠️ Horário Descoberto: ${gap.startTime} — ${gap.endTime} (${gap.workingCount} atendente(s) trabalhando). A regra exige no mínimo ${coverage.minRequiredWorkers}!`
      });
    });
  }

  // 2. Conflito por sobreposição de múltiplos slots do mesmo colaborador
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const s1 = slots[i];
      const s2 = slots[j];
      if (s1.employeeId === s2.employeeId) {
        const start1 = timeToMinutes(s1.startTime);
        const end1 = timeToMinutes(s1.endTime);
        const start2 = timeToMinutes(s2.startTime);
        const end2 = timeToMinutes(s2.endTime);
        if (Math.max(start1, start2) < Math.min(end1, end2)) {
          conflictSlots.add(s1.id);
          conflictSlots.add(s2.id);
          conflictDetails.push({
            type: 'SELF_OVERLAP',
            message: `⚠️ O mesmo colaborador possui horários de almoço sobrepostos (${s1.startTime} e ${s2.startTime}).`
          });
        }
      }
    }
  }

  return {
    hasConflicts: conflictSlots.size > 0 || coverage.hasGaps,
    conflictSlotIds: Array.from(conflictSlots),
    conflictDetails,
    coverage
  };
}

/**
 * Encontra o próximo horário disponível sem deixar o atendimento da janela crítica vazio.
 */
export function findNextAvailableSlot(existingSlots = [], durationMinutes, settings = {}, employees = [], excludeSlotId = null) {
  const startLimit = timeToMinutes(settings.startHour || '11:00');
  const endLimit = timeToMinutes(settings.endHour || '14:00');
  const interval = Number(settings.slotInterval || 5);
  const dur = Number(durationMinutes || settings.defaultDuration || 30);

  const otherSlots = existingSlots.filter((s) => s.id !== excludeSlotId);

  let bestSlot = null;
  let bestCoverage = -1;

  for (let start = startLimit; start + dur <= endLimit; start += interval) {
    const end = start + dur;
    const testSlot = {
      id: 'temp-test-slot',
      employeeId: 'temp-emp',
      startTime: minutesToTime(start),
      endTime: minutesToTime(end)
    };

    const simulatedSlots = [...otherSlots, testSlot];
    const coverage = checkAttendanceCoverage(employees, simulatedSlots, settings);

    if (coverage.isFullyCovered) {
      return {
        startTime: minutesToTime(start),
        endTime: minutesToTime(end)
      };
    }

    if (coverage.coveragePercent > bestCoverage) {
      bestCoverage = coverage.coveragePercent;
      bestSlot = {
        startTime: minutesToTime(start),
        endTime: minutesToTime(end)
      };
    }
  }

  return bestSlot || {
    startTime: minutesToTime(startLimit),
    endTime: minutesToTime(startLimit + dur)
  };
}

/**
 * Algoritmo Inteligente de Geração de Rodízio scadahub:
 *
 * 1. Respeita estritamente a janela crítica configurada (ex: 11:30–13:30 ou 12:00–13:00).
 * 2. Garante que em TODO o período crítico existam no mínimo 'minWorkingDuringCritical' atendentes.
 * 3. Rotaciona a escala de forma justa e uniforme entre os colaboradores ativos.
 * 4. Valida a escala gerada contra a regra de cobertura; se for matematicamente impossível
 *    atender à restrição (ex: equipe menor que o mínimo exigido), reporta o erro explicitamente
 *    sem aplicar uma escala inválida.
 */
export function generateAutoSchedule({
  employees = [],
  date,
  settings = {},
  history = {},
  existingWeekSchedules = {},
  dayOffset = 0,
  rotationIndex = 0
}) {
  const activeEmployees = employees.filter((e) => e.active);
  const N = activeEmployees.length;

  const resultSlots = [];
  resultSlots.success = true;
  resultSlots.error = null;

  if (N === 0) {
    resultSlots.success = false;
    resultSlots.error = 'Nenhum colaborador ativo cadastrado para compor a escala.';
    return resultSlots;
  }

  const duration = Number(settings.defaultDuration || 30);
  const minRequired = Number(settings.minWorkingDuringCritical !== undefined ? settings.minWorkingDuringCritical : 1);
  const critStartMin = timeToMinutes(settings.criticalStart || '11:30');
  const critEndMin = timeToMinutes(settings.criticalEnd || '13:30');
  const lunchStartMin = timeToMinutes(settings.startHour || '11:00');
  const lunchEndMin = timeToMinutes(settings.endHour || '14:00');

  // Restrição básica: se a equipe total é menor que o mínimo exigido no posto
  if (N < minRequired) {
    resultSlots.success = false;
    resultSlots.error = `Equipe insuficiente: existem ${N} colaborador(es) ativo(s), mas o atendimento crítico exige no mínimo ${minRequired} trabalhando.`;
    return resultSlots;
  }

  // Máximo de colaboradores que podem estar em almoço SIMULTANEAMENTE na janela crítica
  const maxSimultaneousLunch = Math.max(0, N - minRequired);

  // Ordena/rotaciona os colaboradores com base na semente de rotação
  const dateObj = new Date(date + 'T12:00:00');
  const dayOfWeek = isNaN(dateObj.getDay()) ? 1 : dateObj.getDay();
  const shiftSeed = (dayOfWeek + dayOffset + rotationIndex) % N;

  const rotatedEmployees = [...activeEmployees];
  for (let i = 0; i < shiftSeed; i++) {
    rotatedEmployees.push(rotatedEmployees.shift());
  }

  // CASO ESPECIAL: maxSimultaneousLunch === 0 (ex: N = 1 e minRequired = 1, ou N = 2 e minRequired = 2)
  // Durante a janela crítica NINGUÉM pode almoçar! O almoço DEVE ser alocado antes ou depois da janela crítica.
  if (maxSimultaneousLunch === 0) {
    // Procura turnos antes de critStartMin ou depois de critEndMin
    const validPreTimes = [];
    for (let t = lunchStartMin; t + duration <= critStartMin; t += 5) {
      validPreTimes.push(t);
    }
    const validPostTimes = [];
    for (let t = critEndMin; t + duration <= lunchEndMin; t += 5) {
      validPostTimes.push(t);
    }
    const availableSlots = [...validPreTimes, ...validPostTimes];

    if (availableSlots.length === 0) {
      resultSlots.success = false;
      resultSlots.error = `Impossível cobrir a janela crítica: com ${N} colaborador(es) e exigência de ${minRequired} ativo(s), não há horários de almoço viáveis fora da janela crítica (${settings.criticalStart || '11:30'} às ${settings.criticalEnd || '13:30'}).`;
      return resultSlots;
    }

    // Distribui cada colaborador em um horário fora da janela crítica
    for (let i = 0; i < N; i++) {
      const emp = rotatedEmployees[i];
      const slotTimeMin = availableSlots[i % availableSlots.length];
      resultSlots.push({
        id: `slot-${date}-${emp.id}`,
        employeeId: emp.id,
        date,
        startTime: minutesToTime(slotTimeMin),
        endTime: minutesToTime(slotTimeMin + duration),
        duration,
        isAutoGenerated: true
      });
    }

    const coverage = checkAttendanceCoverage(employees, resultSlots, settings);
    if (!coverage.isFullyCovered) {
      resultSlots.success = false;
      resultSlots.error = 'Não foi possível encontrar uma escala que garanta 100% de cobertura da janela crítica.';
      resultSlots.length = 0;
    }
    return resultSlots;
  }

  // CASO GERAL: maxSimultaneousLunch >= 1
  // Dividimos os N colaboradores em grupos onde cada grupo tem NO MÁXIMO maxSimultaneousLunch membros
  const maxGroupSize = Math.max(1, Math.min(maxSimultaneousLunch, Math.ceil(N / 2)));
  const numGroups = Math.ceil(N / maxGroupSize);

  // Divide os colaboradores nos grupos
  const groups = [];
  for (let g = 0; g < numGroups; g++) {
    groups.push([]);
  }
  for (let i = 0; i < N; i++) {
    groups[i % numGroups].push(rotatedEmployees[i]);
  }

  // Determina os horários dos grupos para cobrir a janela crítica ou distribuí-los uniformemente
  // Busca a melhor combinação de horários de início que garanta cobertura total
  const critDuration = Math.max(duration, critEndMin - critStartMin);
  const possibleStartMin = Math.max(lunchStartMin, Math.min(critStartMin, lunchEndMin - duration));
  const possibleEndMin = Math.min(lunchEndMin - duration, Math.max(critEndMin - duration, lunchStartMin));

  let bestSchedule = null;

  // Testa diferentes espaçamentos dos turnos
  const stepTry = duration >= 45 ? 15 : 10;
  const offsetsToTry = [0, 5, 10, 15, -5, -10, 20, 25, 30];

  for (let o = 0; o < offsetsToTry.length; o++) {
    const baseOffset = offsetsToTry[o];
    const candidateSlots = [];
    let groupStart = Math.max(lunchStartMin, Math.min(possibleEndMin, critStartMin + baseOffset));

    for (let g = 0; g < groups.length; g++) {
      const gEmployees = groups[g];
      const gStart = Math.max(lunchStartMin, Math.min(lunchEndMin - duration, groupStart + g * duration));
      const gStartTimeStr = minutesToTime(gStart);
      const gEndTimeStr = minutesToTime(gStart + duration);

      for (let e = 0; e < gEmployees.length; e++) {
        candidateSlots.push({
          id: `slot-${date}-${gEmployees[e].id}`,
          employeeId: gEmployees[e].id,
          date,
          startTime: gStartTimeStr,
          endTime: gEndTimeStr,
          duration,
          isAutoGenerated: true
        });
      }
    }

    const testCov = checkAttendanceCoverage(employees, candidateSlots, settings);
    if (testCov.isFullyCovered) {
      bestSchedule = candidateSlots;
      break;
    }
  }

  // Se o espaçamento sequencial não cobriu perfeitamente, tenta posicionar grupos em turnos pré-configurados
  if (!bestSchedule) {
    const shiftPositions = [];
    const span = Math.max(1, (critEndMin - critStartMin - duration));
    for (let g = 0; g < groups.length; g++) {
      const fraction = groups.length > 1 ? g / (groups.length - 1) : 0;
      const t = Math.max(lunchStartMin, Math.min(lunchEndMin - duration, Math.round(critStartMin + fraction * span)));
      shiftPositions.push(Math.round(t / 5) * 5);
    }

    const candidateSlots = [];
    for (let g = 0; g < groups.length; g++) {
      const gEmployees = groups[g];
      const gStart = shiftPositions[g];
      for (let e = 0; e < gEmployees.length; e++) {
        candidateSlots.push({
          id: `slot-${date}-${gEmployees[e].id}`,
          employeeId: gEmployees[e].id,
          date,
          startTime: minutesToTime(gStart),
          endTime: minutesToTime(gStart + duration),
          duration,
          isAutoGenerated: true
        });
      }
    }

    const testCov = checkAttendanceCoverage(employees, candidateSlots, settings);
    if (testCov.isFullyCovered) {
      bestSchedule = candidateSlots;
    }
  }

  if (bestSchedule) {
    bestSchedule.forEach((s) => resultSlots.push(s));
    resultSlots.success = true;
    resultSlots.error = null;
    return resultSlots;
  }

  // Se não foi possível encontrar uma escala 100% coberta
  resultSlots.success = false;
  resultSlots.error = `Não foi possível gerar uma escala com 100% de cobertura para a janela crítica (${settings.criticalStart || '11:30'} às ${settings.criticalEnd || '13:30'}) com as durações e equipe atuais. Ajuste as regras ou os horários.`;
  return resultSlots;
}

/**
 * Calcula métricas de distribuição e histórico por faixas horárias.
 */
export function calculateBalanceMetrics(employees = [], allSchedules = {}, initialHistory = {}) {
  const bands = ['11h-12h', '12h-13h', '13h-14h'];
  const employeeStats = {};

  employees.forEach((emp) => {
    employeeStats[emp.id] = {
      employee: emp,
      counts: {
        '11h-12h': initialHistory[emp.id]?.['11h-12h'] || 0,
        '12h-13h': initialHistory[emp.id]?.['12h-13h'] || 0,
        '13h-14h': initialHistory[emp.id]?.['13h-14h'] || 0
      },
      total: 0
    };
  });

  Object.values(allSchedules).forEach((daySlots) => {
    if (!Array.isArray(daySlots)) return;
    daySlots.forEach((slot) => {
      if (!employeeStats[slot.employeeId]) return;

      const startMinutes = timeToMinutes(slot.startTime);
      if (startMinutes < 720) {
        employeeStats[slot.employeeId].counts['11h-12h']++;
      } else if (startMinutes < 780) {
        employeeStats[slot.employeeId].counts['12h-13h']++;
      } else {
        employeeStats[slot.employeeId].counts['13h-14h']++;
      }
    });
  });

  let totalDeviations = 0;
  let activeCount = 0;

  Object.values(employeeStats).forEach((stat) => {
    stat.total = stat.counts['11h-12h'] + stat.counts['12h-13h'] + stat.counts['13h-14h'];
    if (stat.total > 0 && stat.employee.active) {
      activeCount++;
      const avg = stat.total / 3;
      const dev =
        (Math.abs(stat.counts['11h-12h'] - avg) +
          Math.abs(stat.counts['12h-13h'] - avg) +
          Math.abs(stat.counts['13h-14h'] - avg)) /
        stat.total;
      totalDeviations += dev;
    }
  });

  const averageDeviation = activeCount > 0 ? totalDeviations / activeCount : 0;
  const balanceScore = Math.max(70, Math.min(100, Math.round((1 - averageDeviation) * 100)));

  return {
    employeeStats: Object.values(employeeStats),
    balanceScore,
    balanceStatus: balanceScore >= 85 ? 'Equilibrado' : 'Ajustar Rotação',
    balanceBadgeClass: balanceScore >= 85 ? 'badge-emerald' : 'badge-amber',
    bands
  };
}
