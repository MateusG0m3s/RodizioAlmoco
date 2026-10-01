import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, get, child } from 'firebase/database';
import { defaultFirebaseConfig } from '../firebaseConfig';

const STORAGE_KEY_CONFIG = 'scadahub_firebase_custom_config';

class FirebaseService {
  constructor() {
    this.app = null;
    this.db = null;
    this.isInitialized = false;
    this.isConnected = false;
    this.listeners = [];
  }

  // Obtém a configuração ativa (prioriza configuração salva na UI, senão pega a do arquivo)
  getActiveConfig() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.apiKey) return parsed;
      }
    } catch (e) {
      console.warn('Erro ao ler configuração salva do Firebase:', e);
    }
    return defaultFirebaseConfig;
  }

  saveCustomConfig(config) {
    try {
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
      this.init(config);
      return { success: true, message: 'Configurações do Firebase salvas com sucesso!' };
    } catch (e) {
      return { success: false, message: 'Erro ao salvar configuração: ' + e.message };
    }
  }

  clearCustomConfig() {
    localStorage.removeItem(STORAGE_KEY_CONFIG);
    this.isInitialized = false;
    this.db = null;
  }

  isConfigValid(config) {
    return Boolean(config && (config.databaseURL || (config.apiKey && config.projectId)));
  }

  // Inicializa o Firebase
  init(customConfig = null) {
    const config = customConfig || this.getActiveConfig();

    if (!this.isConfigValid(config)) {
      this.isInitialized = false;
      this.db = null;
      return false;
    }

    try {
      if (getApps().length === 0) {
        this.app = initializeApp(config);
      } else {
        this.app = getApp();
      }

      this.db = getDatabase(this.app);
      this.isInitialized = true;
      return true;
    } catch (err) {
      console.error('Falha ao inicializar o Firebase:', err);
      this.isInitialized = false;
      this.db = null;
      return false;
    }
  }

  // Inscrição em tempo real com ouvintes do Realtime Database
  subscribe({ onSchedules, onEmployees, onSettings, onConnectionStatus }) {
    if (!this.isInitialized) {
      const ok = this.init();
      if (!ok) {
        if (onConnectionStatus) onConnectionStatus(false, 'offline_no_config');
        return () => {};
      }
    }

    try {
      // 1. Monitora status de conexão real do Firebase
      const connectedRef = ref(this.db, '.info/connected');
      const unsubConnected = onValue(connectedRef, (snap) => {
        const isOnline = snap.val() === true;
        this.isConnected = isOnline;
        if (onConnectionStatus) {
          onConnectionStatus(isOnline, isOnline ? 'online' : 'connecting');
        }
      });

      // 2. Escala compartilhada (Schedules)
      const schedulesRef = ref(this.db, 'scadahub_schedules');
      const unsubSchedules = onValue(schedulesRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          if (data && typeof data === 'object' && onSchedules) {
            const normalized = {};
            Object.keys(data).forEach((dateKey) => {
              const val = data[dateKey];
              normalized[dateKey] = Array.isArray(val) ? val : (val && typeof val === 'object' ? Object.values(val) : []);
            });
            onSchedules(normalized);
          }
        }
      });

      // 3. Equipe (Employees)
      const employeesRef = ref(this.db, 'scadahub_employees');
      const unsubEmployees = onValue(employeesRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          if (data && onEmployees) {
            const arr = Array.isArray(data) ? data : Object.values(data);
            if (arr.length > 0) {
              onEmployees(arr);
            }
          }
        }
      });

      // 4. Configurações & Regras
      const settingsRef = ref(this.db, 'scadahub_settings');
      const unsubSettings = onValue(settingsRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          if (data && onSettings) {
            onSettings(data);
          }
        }
      });

      // Retorna função de limpeza (unsubscribe)
      return () => {
        unsubConnected();
        unsubSchedules();
        unsubEmployees();
        unsubSettings();
      };
    } catch (err) {
      console.warn('Erro ao registrar ouvintes do Firebase:', err);
      if (onConnectionStatus) onConnectionStatus(false, 'error');
      return () => {};
    }
  }

  // Salva escala completa no Firebase
  async pushAllSchedules(allSchedules) {
    if (!this.isInitialized || !this.db) return false;
    try {
      await set(ref(this.db, 'scadahub_schedules'), allSchedules);
      return true;
    } catch (err) {
      console.error('Erro ao enviar escalas para o Firebase:', err);
      return false;
    }
  }

  // Salva escala de um dia específico
  async pushDaySchedule(dateStr, slots) {
    if (!this.isInitialized || !this.db) return false;
    try {
      await set(ref(this.db, `scadahub_schedules/${dateStr}`), slots);
      return true;
    } catch (err) {
      console.error('Erro ao enviar escala do dia:', err);
      return false;
    }
  }

  // Salva lista de funcionários
  async pushEmployees(employees) {
    if (!this.isInitialized || !this.db) return false;
    try {
      await set(ref(this.db, 'scadahub_employees'), employees);
      return true;
    } catch (err) {
      console.error('Erro ao enviar funcionários:', err);
      return false;
    }
  }

  // Salva configurações operacionais
  async pushSettings(settings) {
    if (!this.isInitialized || !this.db) return false;
    try {
      await set(ref(this.db, 'scadahub_settings'), settings);
      return true;
    } catch (err) {
      console.error('Erro ao enviar configurações:', err);
      return false;
    }
  }
}

export const firebaseService = new FirebaseService();
