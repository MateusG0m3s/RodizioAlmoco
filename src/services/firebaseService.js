import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, get, child, remove } from 'firebase/database';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { defaultFirebaseConfig } from '../firebaseConfig.js';

const STORAGE_KEY_CONFIG = 'scadahub_firebase_custom_config';

class FirebaseService {
  constructor() {
    this.app = null;
    this.db = null;
    this.auth = null;
    this.isInitialized = false;
    this.isConnected = false;
    this.listeners = [];
  }

  // Obtém a configuração ativa (prioriza configuração salva na UI, senão pega a do arquivo)
  getActiveConfig() {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.apiKey) return parsed;
        }
      }
    } catch {
      // Ignora erro em ambientes de teste sem window
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
    this.auth = null;
  }

  isConfigValid(config) {
    return Boolean(config && (config.databaseURL || (config.apiKey && config.projectId)));
  }

  // Inicializa o Firebase (Database + Auth)
  init(customConfig = null) {
    const config = customConfig || this.getActiveConfig();

    if (!this.isConfigValid(config)) {
      this.isInitialized = false;
      this.db = null;
      this.auth = null;
      return false;
    }

    try {
      if (getApps().length === 0) {
        this.app = initializeApp(config);
      } else {
        this.app = getApp();
      }

      this.db = getDatabase(this.app);
      try {
        this.auth = getAuth(this.app);
      } catch (authErr) {
        console.warn('Firebase Auth não inicializado no ambiente local:', authErr);
      }

      this.isInitialized = true;
      return true;
    } catch (err) {
      console.error('Falha ao inicializar o Firebase:', err);
      this.isInitialized = false;
      this.db = null;
      this.auth = null;
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

  // --- Operações Granulares de Escala (em conformidade com as Security Rules) ---

  // Salva slot específico de um colaborador (escrita permitida pelo próprio usuário ou admin)
  async pushSlot(dateStr, slotData) {
    if (!this.isInitialized || !this.db) return false;
    const key = slotData.id || slotData.employeeId;
    if (!key) return false;

    try {
      await set(ref(this.db, `scadahub_schedules/${dateStr}/${key}`), slotData);
      return true;
    } catch (err) {
      console.error('Erro ao enviar slot para o Firebase:', err);
      return false;
    }
  }

  // Remove slot específico de um colaborador
  async deleteSlot(dateStr, slotId) {
    if (!this.isInitialized || !this.db) return false;
    try {
      await remove(ref(this.db, `scadahub_schedules/${dateStr}/${slotId}`));
      return true;
    } catch (err) {
      console.error('Erro ao remover slot do Firebase:', err);
      return false;
    }
  }

  // Salva escala completa de um dia específico (Geração automática - Exclusivo Admin)
  async pushDaySchedule(dateStr, slots) {
    if (!this.isInitialized || !this.db) return false;
    try {
      let payload = null;
      if (Array.isArray(slots) && slots.length > 0) {
        const slotMap = {};
        slots.forEach((s) => {
          const k = s.id || s.employeeId;
          if (k) slotMap[k] = s;
        });
        payload = slotMap;
      } else if (slots && typeof slots === 'object') {
        payload = slots;
      }
      await set(ref(this.db, `scadahub_schedules/${dateStr}`), payload);
      return true;
    } catch (err) {
      console.error('Erro ao enviar escala do dia:', err);
      return false;
    }
  }

  // Salva escala completa no Firebase (Exclusivo Admin)
  async pushAllSchedules(allSchedules) {
    if (!this.isInitialized || !this.db) return false;
    try {
      const cleanMap = {};
      if (allSchedules && typeof allSchedules === 'object') {
        Object.keys(allSchedules).forEach((k) => {
          const list = Array.isArray(allSchedules[k]) ? allSchedules[k] : (allSchedules[k] && typeof allSchedules[k] === 'object' ? Object.values(allSchedules[k]) : []);
          if (list.length > 0) {
            const dayMap = {};
            list.forEach((s) => {
              const sid = s.id || s.employeeId;
              if (sid) dayMap[sid] = s;
            });
            cleanMap[k] = dayMap;
          }
        });
      }
      await set(ref(this.db, 'scadahub_schedules'), Object.keys(cleanMap).length > 0 ? cleanMap : null);
      return true;
    } catch (err) {
      console.error('Erro ao enviar escalas para o Firebase:', err);
      return false;
    }
  }

  // --- Operações Granulares de Colaboradores ---

  // Salva ou atualiza colaborador individual (permitido para o próprio usuário ou admin)
  async pushEmployee(empId, employeeData) {
    if (!this.isInitialized || !this.db) return false;
    try {
      await set(ref(this.db, `scadahub_employees/${empId}`), employeeData);
      return true;
    } catch (err) {
      console.error('Erro ao enviar funcionário:', err);
      return false;
    }
  }

  // Exclui colaborador (Exclusivo Admin)
  async deleteEmployee(empId) {
    if (!this.isInitialized || !this.db) return false;
    try {
      await remove(ref(this.db, `scadahub_employees/${empId}`));
      return true;
    } catch (err) {
      console.error('Erro ao excluir funcionário:', err);
      return false;
    }
  }

  // Salva lista de funcionários em massa (Exclusivo Admin)
  async pushEmployees(employees) {
    if (!this.isInitialized || !this.db) return false;
    try {
      let payload = null;
      if (Array.isArray(employees)) {
        payload = {};
        employees.forEach((emp) => {
          if (emp.id) payload[emp.id] = emp;
        });
      } else {
        payload = employees;
      }
      await set(ref(this.db, 'scadahub_employees'), payload);
      return true;
    } catch (err) {
      console.error('Erro ao enviar funcionários:', err);
      return false;
    }
  }

  // Busca lista de colaboradores diretamente no Firebase Realtime Database
  async getEmployees() {
    if (!this.isInitialized || !this.db) {
      this.init();
    }
    if (!this.db) return null;
    try {
      const snap = await get(ref(this.db, 'scadahub_employees'));
      if (snap.exists()) {
        const val = snap.val();
        return Array.isArray(val) ? val : Object.values(val);
      }
      return null;
    } catch (err) {
      console.warn('Erro ao buscar funcionários do Firebase RTDB:', err);
      return null;
    }
  }

  // Salva configurações operacionais (Exclusivo Admin)
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

  // --- Métodos de Verificação de Permissão no Firebase ---

  async checkIfAdmin(uid) {
    if (!this.isInitialized || !this.db || !uid) return false;
    try {
      const snap = await get(child(ref(this.db), `scadahub_admins/${uid}`));
      return snap.exists() && snap.val() === true;
    } catch (e) {
      return false;
    }
  }

  async getUserRecord(uid) {
    if (!this.isInitialized || !this.db || !uid) return null;
    try {
      const snap = await get(child(ref(this.db), `scadahub_users/${uid}`));
      return snap.exists() ? snap.val() : null;
    } catch (e) {
      return null;
    }
  }

  // --- Métodos do Firebase Authentication ---

  onAuthStateChange(callback) {
    if (!this.auth) {
      this.init();
    }
    if (!this.auth) {
      if (typeof callback === 'function') callback(null);
      return () => {};
    }
    return onAuthStateChanged(this.auth, callback);
  }

  async signInWithEmail(email, password) {
    if (!this.auth) {
      this.init();
    }
    if (!this.auth) return { success: false, code: 'auth/not-initialized', message: 'Serviço de autenticação não inicializado.' };
    try {
      const res = await signInWithEmailAndPassword(this.auth, email, password);
      return { success: true, user: res.user };
    } catch (err) {
      return { success: false, code: err.code || 'auth/unknown', message: err.message };
    }
  }

  async signOutAuth() {
    if (!this.auth) return;
    try {
      await signOut(this.auth);
    } catch (e) {
      console.warn('Erro ao deslogar do Firebase:', e);
    }
  }
}

export const firebaseService = new FirebaseService();
