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

test('SUÍTE NOTIFICAÇÃO SONORA 3: Lógica de deduplicação estrita de ocorrência', () => {
  const firedAlerts = new Set();
  let soundPlayCount = 0;

  function simulateTick(slot, currentDate, currentMinutes, soundEnabled) {
    const startMin = 12 * 60; // 12:00 = 720
    const minutesRemaining = startMin - currentMinutes;

    if (shouldTriggerLunchAlert(minutesRemaining)) {
      const alertKey = `${currentDate}_${slot.id}_${slot.startTime}_${minutesRemaining}min`;
      if (!firedAlerts.has(alertKey)) {
        firedAlerts.add(alertKey);
        if (soundEnabled) {
          soundPlayCount++;
        }
        return { fired: true, soundPlayed: soundEnabled };
      }
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
    assert.equal(reRenderRes.fired, false, 'Re-renderização NÃO deve disparar novamente');
    assert.equal(reRenderRes.soundPlayed, false, 'Re-renderização NÃO deve tocar som duplicado');
  }
  assert.equal(soundPlayCount, 1, 'Contador de sons deve continuar em 1');

  // 3. Minuto 11:51 (9 min antes)
  const res9m = simulateTick(slot, date, 711, true);
  assert.equal(res9m.fired, false);
  assert.equal(soundPlayCount, 1);

  // 4. Minuto 11:55 (5 min antes) com som ativado
  const res5m = simulateTick(slot, date, 715, true);
  assert.equal(res5m.fired, true);
  assert.equal(res5m.soundPlayed, true);
  assert.equal(soundPlayCount, 2);

  // 5. Minuto 11:59 (1 min antes) com usuário no modo Mudo (soundEnabled = false)
  const res1mMudo = simulateTick(slot, date, 719, false);
  assert.equal(res1mMudo.fired, true, 'Ocorrência registrada');
  assert.equal(res1mMudo.soundPlayed, false, 'No modo Mudo o som NÃO é reproduzido');
  assert.equal(soundPlayCount, 2, 'Contador de sons continua em 2');
});

test('SUÍTE NOTIFICAÇÃO SONORA 4: Segurança em ambiente sem AudioContext (Node/SSR/Restrições)', () => {
  // Em ambiente Node.js, AudioContext não existe no global
  const result = playLunchNotificationSound();
  assert.equal(result, false, 'Deve retornar false com segurança sem lançar exceções');
});
