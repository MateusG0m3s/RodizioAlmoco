/**
 * soundService.js
 * Gerenciador de notificações sonoras e preferências individuais de áudio.
 */

const STORAGE_PREFIX = 'scadahub_sound_enabled_';

/**
 * Obtém a chave de armazenamento individual por usuário
 */
export function getSoundStorageKey(user) {
  if (!user) return `${STORAGE_PREFIX}guest`;
  const id = (user.email || user.uid || user.employeeId || 'user').trim().toLowerCase();
  return `${STORAGE_PREFIX}${id}`;
}

/**
 * Retorna a preferência individual de som do usuário (padrão: true / Tocar)
 */
export function getUserSoundPreference(user) {
  try {
    if (typeof localStorage === 'undefined') return true;
    const key = getSoundStorageKey(user);
    const saved = localStorage.getItem(key);
    if (saved !== null) {
      return saved === 'true';
    }
    return true; // Padrão: Notificações ativadas (Tocar)
  } catch {
    return true;
  }
}

/**
 * Salva a preferência individual de som do usuário
 */
export function setUserSoundPreference(user, enabled) {
  try {
    if (typeof localStorage === 'undefined') return;
    const key = getSoundStorageKey(user);
    localStorage.setItem(key, String(Boolean(enabled)));
  } catch {
    // Silencia eventuais restrições de localStorage
  }
}

let sharedAudioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!sharedAudioCtx) {
    try {
      sharedAudioCtx = new AudioContextClass();
    } catch {
      return null;
    }
  }
  return sharedAudioCtx;
}

// Desbloqueia o AudioContext na primeira interação do usuário com a página
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    try {
      if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
        sharedAudioCtx.resume().catch(() => {});
      }
    } catch {}
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
  };
  window.addEventListener('click', unlockAudio, { passive: true });
  window.addEventListener('keydown', unlockAudio, { passive: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true });
}

/**
 * Reproduz o sinal sonoro discreto e adequado para notificação de sistema (dois tons suaves).
 * Retorna true se executado com sucesso ou false se bloqueado/indisponível.
 */
export function playLunchNotificationSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return false;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Primeiro tom suave: D5 (587.33 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.0001, now);
    gain1.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Segundo tom harmonioso: A5 (880.00 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.0, now + 0.12);
    gain2.gain.setValueAtTime(0.0001, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.20, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.6);

    return true;
  } catch {
    // Trata limitações de navegadores de forma segura
    return false;
  }
}

/**
 * Utilitário para verificar se o momento atual é um dos momentos de aviso (10, 5 ou 1 minuto)
 */
export const LUNCH_ALERT_THRESHOLDS = [10, 5, 1];

export function shouldTriggerLunchAlert(minutesRemaining) {
  return LUNCH_ALERT_THRESHOLDS.includes(minutesRemaining);
}
