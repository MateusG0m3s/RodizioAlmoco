import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getSoundStorageKey,
  getUserSoundPreference,
  setUserSoundPreference,
  shouldTriggerLunchAlert,
  LUNCH_ALERT_THRESHOLDS,
  playLunchNotificationSound
} from '../src/services/soundService.js';

// Setup Mock do localStorage para testes de ambiente Node
const localStore = {};
globalThis.localStorage = {
  getItem: (k) => (k in localStore ? localStore[k] : null),
  setItem: (k, v) => { localStore[k] = String(v); },
  removeItem: (k) => { delete localStore[k]; },
  clear: () => { Object.keys(localStore).forEach(k => delete localStore[k]); }
};

test('SUÍTE NOTIFICAÇÃO SONORA 1: Preferência individual por usuário', () => {
  localStorage.clear();

  const userA = { email: 'mateus.silva@scadahub.io', uid: 'user-1' };
  const userB = { email: 'mateusaugusto1441@gmail.com', uid: 'user-2' };
  const guest = null;

  // 1. Padrão inicial deve ser Tocar (true)
  assert.equal(getUserSoundPreference(userA), true, 'Usuário A deve iniciar com som ativado (Tocar)');
  assert.equal(getUserSoundPreference(userB), true, 'Usuário B deve iniciar com som ativado (Tocar)');
  assert.equal(getUserSoundPreference(guest), true, 'Visitante deve iniciar com som ativado (Tocar)');

  // 2. Usuário A altera para Mudo (false)
  setUserSoundPreference(userA, false);
  assert.equal(getUserSoundPreference(userA), false, 'Usuário A agora deve estar como Mudo (false)');

  // 3. Usuário B deve continuar como Tocar (true) - isolamento individual
  assert.equal(getUserSoundPreference(userB), true, 'Usuário B deve continuar como Tocar (true)');

  // 4. Usuário B altera para Mudo (false) e depois volta para Tocar (true)
  setUserSoundPreference(userB, false);
  assert.equal(getUserSoundPreference(userB), false, 'Usuário B mutado');
  setUserSoundPreference(userB, true);
  assert.equal(getUserSoundPreference(userB), true, 'Usuário B reativou som (Tocar)');

  // 5. Usuário A permanece como Mudo (false)
  assert.equal(getUserSoundPreference(userA), false, 'Usuário A permanece Mudo mesmo após login/alteração do Usuário B');
});

test('SUÍTE NOTIFICAÇÃO SONORA 2: Validação dos marcos de aviso (10, 5 e 1 minuto antes)', () => {
  assert.deepEqual(LUNCH_ALERT_THRESHOLDS, [10, 5, 1], 'Marcos devem ser exatamente 10, 5 e 1 minuto');

  // Marcos válidos que devem disparar
  assert.equal(shouldTriggerLunchAlert(10), true, 'Deve disparar a 10 minutos do almoço');
  assert.equal(shouldTriggerLunchAlert(5), true, 'Deve disparar a 5 minutos do almoço');
  assert.equal(shouldTriggerLunchAlert(1), true, 'Deve disparar a 1 minuto do almoço');

  // Minutos fora dos marcos que NÃO devem disparar
  assert.equal(shouldTriggerLunchAlert(15), false, 'Não deve disparar a 15 minutos');
  assert.equal(shouldTriggerLunchAlert(11), false, 'Não deve disparar a 11 minutos');
  assert.equal(shouldTriggerLunchAlert(9), false, 'Não deve disparar a 9 minutos');
  assert.equal(shouldTriggerLunchAlert(6), false, 'Não deve disparar a 6 minutos');
  assert.equal(shouldTriggerLunchAlert(4), false, 'Não deve disparar a 4 minutos');
  assert.equal(shouldTriggerLunchAlert(2), false, 'Não deve disparar a 2 minutos');
  assert.equal(shouldTriggerLunchAlert(0), false, 'Não deve disparar quando o almoço já começou (0 min)');
  assert.equal(shouldTriggerLunchAlert(-5), false, 'Não deve disparar após o horário do almoço');
});

test('SUÍTE NOTIFICAÇÃO SONORA 3: Lógica de deduplicação e rearme ao mover o ponteiro', () => {
  let lastActiveAlertKey = null;
  let soundPlayCount = 0;

  function simulateTick(slot, currentDate, currentMinutes, soundEnabled) {
    const startMin = 12 * 60; // 12:00 = 720
    const minutesRemaining = startMin - currentMinutes;

    if (shouldTriggerLunchAlert(minutesRemaining)) {
      const alertKey = `${currentDate}_${slot.id}_${slot.startTime}_${minutesRemaining}min`;
      if (lastActiveAlertKey !== alertKey) {
        lastActiveAlertKey = alertKey;
        if (soundEnabled) {
          soundPlayCount++;
        }
        return { fired: true, soundPlayed: soundEnabled };
      }
    } else {
      lastActiveAlertKey = null;
    }
    return { fired: false, soundPlayed: false };
  }

  const slot = { id: 'slot-1', employeeId: 'emp-1', startTime: '12:00' };
  const date = '2026-10-06';

  // 1. Minuto 11:50 (10 min antes) - primeiro tick de 10s
  const res1 = simulateTick(slot, date, 710, true);
  assert.equal(res1.fired, true, 'Deve registrar disparo aos 10 minutos');
  assert.equal(res1.soundPlayed, true, 'Deve reproduzir som aos 10 minutos');
  assert.equal(soundPlayCount, 1);

  // 2. Re-renderizações ou ticks subsequentes no mesmo minuto (ex: 10s depois ainda é 11:50)
  for (let i = 0; i < 5; i++) {
    const reRenderRes = simulateTick(slot, date, 710, true);
    assert.equal(reRenderRes.fired, false, 'Re-renderização NÃO deve disparar novamente no mesmo minuto');
    assert.equal(reRenderRes.soundPlayed, false, 'Re-renderização NÃO deve tocar som duplicado');
  }
  assert.equal(soundPlayCount, 1, 'Contador de sons deve continuar em 1');

  // 3. Voltar o ponteiro para 11:40 (20 min antes)
  const resVoltar = simulateTick(slot, date, 700, true);
  assert.equal(resVoltar.fired, false, 'Não dispara fora dos marcos');
  assert.equal(soundPlayCount, 1);

  // 4. Passar novamente por 11:50 (10 min antes) após ter voltado o ponteiro
  const resReentrada = simulateTick(slot, date, 710, true);
  assert.equal(resReentrada.fired, true, 'DEVE disparar novamente após voltar o ponteiro e passar pelo marco!');
  assert.equal(resReentrada.soundPlayed, true, 'DEVE reproduzir o som novamente!');
  assert.equal(soundPlayCount, 2, 'Contador de sons agora é 2');

  // 5. Minuto 11:51 (9 min antes)
  const res9m = simulateTick(slot, date, 711, true);
  assert.equal(res9m.fired, false);
  assert.equal(soundPlayCount, 2);

  // 6. Minuto 11:55 (5 min antes) com som ativado
  const res5m = simulateTick(slot, date, 715, true);
  assert.equal(res5m.fired, true);
  assert.equal(res5m.soundPlayed, true);
  assert.equal(soundPlayCount, 3);

  // 7. Voltar o ponteiro direto de 11:55 para 11:50
  const resVoltarPara10m = simulateTick(slot, date, 710, true);
  assert.equal(resVoltarPara10m.fired, true, 'Deve disparar ao transitar entre marcos diferentes');
  assert.equal(resVoltarPara10m.soundPlayed, true);
  assert.equal(soundPlayCount, 4);

  // 8. Minuto 11:59 (1 min antes) com usuário no modo Mudo (soundEnabled = false)
  // Primeiro recuamos para 11:58
  simulateTick(slot, date, 718, false);
  const res1mMudo = simulateTick(slot, date, 719, false);
  assert.equal(res1mMudo.fired, true, 'Ocorrência registrada aos 1 min');
  assert.equal(res1mMudo.soundPlayed, false, 'No modo Mudo o som NÃO é reproduzido');
  assert.equal(soundPlayCount, 4, 'Contador de sons continua em 4');
});

test('SUÍTE NOTIFICAÇÃO SONORA 4: Segurança em ambiente sem AudioContext (Node/SSR/Restrições)', () => {
  // Em ambiente Node.js, AudioContext não existe no global
  const result = playLunchNotificationSound();
  assert.equal(result, false, 'Deve retornar false com segurança sem lançar exceções');
});

test('SUÍTE NOTIFICAÇÃO SONORA 5: Restrição exclusiva ao próprio colaborador autenticado', () => {
  let lastActiveAlertKey = null;
  let soundPlayCount = 0;

  function evaluateAlertForUser(currentUserId, slots, currentMinutes, soundEnabled) {
    if (!currentUserId) {
      lastActiveAlertKey = null;
      return { triggered: false };
    }

    const ownSlot = slots.find(s => s.employeeId === currentUserId);
    if (!ownSlot) {
      lastActiveAlertKey = null;
      return { triggered: false };
    }

    const startMin = 12 * 60; // 12:00 = 720
    const minutesRemaining = startMin - currentMinutes;

    if (shouldTriggerLunchAlert(minutesRemaining)) {
      const alertKey = `2026-10-06_${ownSlot.id}_${ownSlot.startTime}_${minutesRemaining}min`;
      if (lastActiveAlertKey !== alertKey) {
        lastActiveAlertKey = alertKey;
        if (soundEnabled) soundPlayCount++;
        return { triggered: true };
      }
    } else {
      lastActiveAlertKey = null;
    }
    return { triggered: false };
  }

  const slots = [
    { id: 'slot-outro', employeeId: 'colaborador-2', startTime: '12:00' },
    { id: 'slot-meu', employeeId: 'meu-id-1', startTime: '12:00' }
  ];

  // 1. Usuário não autenticado no horário de 11:50
  const resAnon = evaluateAlertForUser(null, slots, 710, true);
  assert.equal(resAnon.triggered, false, 'Usuário anônimo não deve acionar alarme');
  assert.equal(soundPlayCount, 0);

  // 2. Colaborador-3 (não tem slot escalado)
  const resSemSlot = evaluateAlertForUser('colaborador-3', slots, 710, true);
  assert.equal(resSemSlot.triggered, false, 'Colaborador sem slot não deve acionar som para almoço alheio');
  assert.equal(soundPlayCount, 0);

  // 3. Colaborador-2 tem almoço às 12:00. O usuário logado é 'colaborador-2'. Faltam 10 minutos (11:50).
  const resProprio = evaluateAlertForUser('colaborador-2', slots, 710, true);
  assert.equal(resProprio.triggered, true, 'Deve acionar som quando for o almoço do próprio usuário!');
  assert.equal(soundPlayCount, 1);
});

test('SUÍTE NOTIFICAÇÃO 6: Alerta Visual da Equipe e Visibilidade de Horários (Samara e Colegas)', () => {
  function getVisualAlert(currentUserEmployeeId, upcomingSlots) {
    const nextSlot = upcomingSlots[0] || null;
    const ownUpcomingSlot = currentUserEmployeeId
      ? upcomingSlots.find((s) => s.employeeId === currentUserEmployeeId)
      : null;
    const slotForAlert = ownUpcomingSlot || nextSlot;

    if (!slotForAlert) return null;
    const isOwn = Boolean(currentUserEmployeeId && slotForAlert.employeeId === currentUserEmployeeId);
    return {
      slot: slotForAlert,
      isOwn,
      messagePrefix: isOwn ? 'Seu almoço começa em ' : 'O almoço começa em '
    };
  }

  const upcomingSlots = [
    { id: 'slot-mateus', employeeId: 'emp-1', startTime: '12:00' },
    { id: 'slot-samara', employeeId: 'emp-4', startTime: '12:30' }
  ];

  // Cenário 1: Samara logada (emp-4) quando o próximo almoço é de Mateus (emp-1)
  // Samara DEVE conseguir ver o horário do Mateus no alerta visual
  const alertParaSamara = getVisualAlert('emp-4', upcomingSlots);
  assert.ok(alertParaSamara, 'Samara deve receber alerta visual da escala');
  assert.equal(alertParaSamara.slot.employeeId, 'emp-4', 'Se Samara tem slot próximo, prioriza o dela');

  // Caso Samara NÃO tenha slot próximo e outro colega tenha:
  const slotsSemSamara = [{ id: 'slot-mateus', employeeId: 'emp-1', startTime: '12:00' }];
  const alertSamaraVeColega = getVisualAlert('emp-4', slotsSemSamara);
  assert.ok(alertSamaraVeColega, 'Samara deve ver o almoço do colega na escala');
  assert.equal(alertSamaraVeColega.slot.employeeId, 'emp-1');
  assert.equal(alertSamaraVeColega.isOwn, false);
  assert.equal(alertSamaraVeColega.messagePrefix, 'O almoço começa em ');

  // Cenário 2: Outros usuários logados (ex: emp-1 ou emp-2) quando o próximo almoço é da Samara
  // Os colegas DEVEM conseguir ver o almoço da Samara no alerta visual
  const slotsSoSamara = [{ id: 'slot-samara', employeeId: 'emp-4', startTime: '12:30' }];
  const alertColegasVeemSamara = getVisualAlert('emp-1', slotsSoSamara);
  assert.ok(alertColegasVeemSamara, 'Colegas devem ver o almoço da Samara no banner');
  assert.equal(alertColegasVeemSamara.slot.employeeId, 'emp-4');
  assert.equal(alertColegasVeemSamara.isOwn, false);
  assert.equal(alertColegasVeemSamara.messagePrefix, 'O almoço começa em ');
});

