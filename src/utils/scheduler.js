import { timeToMinutes, minutesToTime, addMinutesToTime } from './timeUtils';

/**
 * Valida a Cobertura de Atendimento ao Cliente durante o período crítico (11:30 às 13:30).
 * Garante que NUNCA fique nenhum horário vazio sem atendentes trabalhando.
 */
export function checkAttendanceCoverage(employees, slots, settings) {
  const activeEmployees = employees.filter((e) => e.active);
  const criticalStartMin = timeToMinutes(settings.criticalStart || '11:30');
  const criticalEndMin = timeToMinutes(settings.criticalEnd || '13:30');
  const minRequiredWorkers = settings.minWorkingDuringCritical || 1;
  const interval = settings.slotInterval || 5;

  const totalCriticalMinutes = criticalEndMin - criticalStartMin;
  let minutesWithoutCoverage = 0;
  let minWorkersSeen = activeEmployees.length;

  const gaps = [];
  let currentGap = null;

  for (let m = criticalStartMin; m < criticalEndMin; m += interval) {
    let lunchingCount = 0;
    slots.forEach((slot) => {
      const isEmpActive = activeEmployees.some((e) => e.id === slot.employeeId);
      if (!isEmpActive) return;

      const sStart = timeToMinutes(slot.startTime);
      const sEnd = timeToMinutes(slot.endTime);
      if (m >= sStart && m < sEnd) {
        lunchingCount++;
      }
    });

    const workingCount = Math.max(0, activeEmployees.length - lunchingCount);
    if (workingCount < minWorkersSeen) {
      minWorkersSeen = workingCount;
    }

    if (workingCount < minRequiredWorkers) {
      minutesWithoutCoverage += interval;
      if (!currentGap) {
        currentGap = { start: m, end: m + interval, workingCount };
      } else {
        currentGap.end = m + interval;
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

  const coveragePercent = Math.round(
    ((totalCriticalMinutes - minutesWithoutCoverage) / totalCriticalMinutes) * 100
  );

  return {
    isFullyCovered: gaps.length === 0,
    hasGaps: gaps.length > 0,
    gaps,
    coveragePercent: Math.max(0, Math.min(100, coveragePercent)),
    minWorkersOnDuty: minWorkersSeen,
    criticalWindow: `${settings.criticalStart || '11:30'} — ${settings.criticalEnd || '13:30'}`
  };
}

/**
 * Detecta conflitos de escala: horários descobertos de atendimento aos clientes.
 */
export function detectConflicts(slots, settings = {}, employees = []) {
  const coverage = checkAttendanceCoverage(employees, slots, settings);
  const conflictSlots = new Set();
  const conflictDetails = [];

  if (coverage.hasGaps) {
    coverage.gaps.forEach((gap) => {
      const gStart = timeToMinutes(gap.startTime);
      const gEnd = timeToMinutes(gap.endTime);

      slots.forEach((s) => {
        const sStart = timeToMinutes(s.startTime);
        const sEnd = timeToMinutes(s.endTime);
        if (Math.max(gStart, sStart) < Math.min(gEnd, sEnd)) {
          conflictSlots.add(s.id);
        }
      });

      conflictDetails.push({
        message: `⚠️ Horário Descoberto: ${gap.startTime} — ${gap.endTime} (${gap.workingCount} atendentes trabalhando). Clientes ficam sem suporte!`
      });
    });
  }

  return {
    hasConflicts: conflictSlots.size > 0,
    conflictSlotIds: Array.from(conflictSlots),
    conflictDetails,
    coverage
  };
}

/**
 * Encontra o próximo horário disponível sem deixar o atendimento vazio.
 */
export function findNextAvailableSlot(existingSlots, durationMinutes, settings, employees, excludeSlotId = null) {
  const startLimit = timeToMinutes(settings.startHour || '11:00');
  const endLimit = timeToMinutes(settings.endHour || '14:00');
  const interval = settings.slotInterval || 5;

  const otherSlots = existingSlots.filter((s) => s.id !== excludeSlotId);

  for (let start = startLimit; start + durationMinutes <= endLimit; start += interval) {
    const end = start + durationMinutes;
    const testSlot = {
      id: 'temp-test',
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
  }

  return {
    startTime: minutesToTime(startLimit),
    endTime: minutesToTime(startLimit + durationMinutes)
  };
}

/**
 * Algoritmo Inteligente de Rodízio scadahub:
 * Garante que o atendimento aos clientes (11:30 às 13:30) nunca fique sem ninguém,
 * e a cada geração rotaciona os turnos para haver alternância visível de quem almoça mais cedo ou mais tarde!
 */
export function generateAutoSchedule({
  employees,
  date,
  settings,
  history = {},
  existingWeekSchedules = {},
  dayOffset = 0,
  rotationIndex = 0
}) {
  const activeEmployees = employees.filter((e) => e.active);
  if (activeEmployees.length === 0) return [];

  const duration = settings.defaultDuration || 30;
  const dateObj = new Date(date + 'T12:00:00');
  
  // Combina o dia da semana com a rotação solicitada para alternar os funcionários
  const shiftSeed = (dateObj.getDay() + dayOffset + rotationIndex) % activeEmployees.length;

  const rotatedEmployees = [...activeEmployees];
  for (let i = 0; i < shiftSeed; i++) {
    rotatedEmployees.push(rotatedEmployees.shift());
  }

  const critStart = settings.criticalStart || '11:30';
  const critStartMin = timeToMinutes(critStart);

  // Calcula horários dos turnos de forma dinâmica conforme a duração selecionada
  // Garantia absoluta: Grupo 1 e Grupo 2 nunca almoçam ao mesmo tempo!
  let startGroup1Min, startGroup2Min;

  if (duration >= 60) {
    // Para 60 min: 11:30 - 12:30 e 12:30 - 13:30 (cobre perfeitamente as 2h críticas)
    startGroup1Min = critStartMin;
    startGroup2Min = critStartMin + 60;
  } else if (duration >= 45) {
    const offsets45 = [0, 15, 30];
    const off45 = offsets45[(dayOffset + rotationIndex) % offsets45.length];
    startGroup1Min = critStartMin + off45;
    startGroup2Min = startGroup1Min + duration;
  } else if (duration >= 30) {
    const patterns30 = [
      { t1: 705, t2: 755 }, // 11:45 e 12:35
      { t1: 695, t2: 745 }, // 11:35 e 12:25
      { t1: 720, t2: 765 }, // 12:00 e 12:45
      { t1: 690, t2: 750 }  // 11:30 e 12:30
    ];
    const pat = patterns30[(dayOffset + rotationIndex) % patterns30.length];
    startGroup1Min = pat.t1;
    startGroup2Min = pat.t2;
  } else {
    const offsets20 = [0, 20, 30, 40];
    const off = offsets20[(dayOffset + rotationIndex) % offsets20.length];
    startGroup1Min = critStartMin + off;
    startGroup2Min = startGroup1Min + duration + 10;
  }

  // Alternância de ordem: quem vai no 1º turno vs 2º turno
  const flipTurns = Math.floor((rotationIndex + dayOffset) / 2) % 2 === 1;
  const finalStart1 = flipTurns ? startGroup2Min : startGroup1Min;
  const finalStart2 = flipTurns ? startGroup1Min : startGroup2Min;

  const startGroup1 = minutesToTime(finalStart1);
  const endGroup1 = addMinutesToTime(startGroup1, duration);

  const startGroup2 = minutesToTime(finalStart2);
  const endGroup2 = addMinutesToTime(startGroup2, duration);

  const generatedSlots = [];

  if (rotatedEmployees.length >= 2) {
    const half = Math.ceil(rotatedEmployees.length / 2);
    const group1 = rotatedEmployees.slice(0, half);
    const group2 = rotatedEmployees.slice(half);

    group1.forEach((emp) => {
      generatedSlots.push({
        id: `slot-${date}-${emp.id}`,
        employeeId: emp.id,
        date,
        startTime: startGroup1,
        endTime: endGroup1,
        duration,
        isAutoGenerated: true
      });
    });

    group2.forEach((emp) => {
      generatedSlots.push({
        id: `slot-${date}-${emp.id}`,
        employeeId: emp.id,
        date,
        startTime: startGroup2,
        endTime: endGroup2,
        duration,
        isAutoGenerated: true
      });
    });
  } else {
    const emp = rotatedEmployees[0];
    generatedSlots.push({
      id: `slot-${date}-${emp.id}`,
      employeeId: emp.id,
      date,
      startTime: critStart,
      endTime: addMinutesToTime(critStart, duration),
      duration,
      isAutoGenerated: true
    });
  }

  return generatedSlots;
}

/**
 * Calcula métricas de distribuição e histórico por faixas horárias.
 */
export function calculateBalanceMetrics(employees, allSchedules, initialHistory = {}) {
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
