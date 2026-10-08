import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, get, remove } from 'firebase/database';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { defaultFirebaseConfig } from '../firebaseConfig.js';

const STORAGE_KEY_CONFIG = 'scadahub_firebase_custom_config';

// Parâmetros da contingência HTTPS (REST) para redes que bloqueiam o WebSocket do Firebase
const REST_FALLBACK_GRACE_MS = 5000;
const REST_POLL_INTERVAL_MS = 5000;
const REST_REQUEST_TIMEOUT_MS = 12000;
const SDK_WRITE_TIMEOUT_MS = 8000;

const normalizeScheduleMap = (data) => {
  const normalized = {};
  if (!data || typeof data !== 'object') return normalized;
  Object.keys(data).forEach((dateKey) => {
    const val = data[dateKey];
    normalized[dateKey] = Array.isArray(val)
      ? val.filter(Boolean)
      : (val && typeof val === 'object' ? Object.values(val).filter(Boolean) : []);
  });
  return normalized;
};

const normalizeEmployeeList = (data) => {
  if (!data || typeof data !== 'object') return [];
  return (Array.isArray(data) ? data : Object.values(data)).filter(Boolean);
};

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

  // --- Transporte HTTPS (REST) de contingência ---
  // Quando o WebSocket do Realtime Database é bloqueado (proxy/firewall/antivírus), o SDK nunca
  // conecta: nada chega do servidor e as gravações ficam apenas na fila local do navegador.
  // Nesses casos a leitura e a escrita passam a ocorrer via HTTPS, que sempre está liberado.

  getRestBaseUrl() {
    const cfg = (this.app && this.app.options) || this.getActiveConfig();
    if (cfg && cfg.databaseURL) return String(cfg.databaseURL).replace(/\/+$/, '');
    if (cfg && cfg.projectId) return `https://${cfg.projectId}-default-rtdb.firebaseio.com`;
    return null;
  }

  async getRestAuthQuery() {
    try {
      const user = this.auth && this.auth.currentUser;
      if (user) return `?auth=${encodeURIComponent(await user.getIdToken())}`;
    } catch {
      // Sem sessão do Firebase Authentication: segue como requisição pública
    }
    return '';
  }

  async restRequest(method, path, body) {
    const base = this.getRestBaseUrl();
    if (!base || typeof fetch !== 'function') throw new Error('Transporte REST indisponível');

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), REST_REQUEST_TIMEOUT_MS) : null;
    try {
      const hasBody = body !== undefined;
      const res = await fetch(`${base}/${path}.json${await this.getRestAuthQuery()}`, {
        method,
        headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
        body: hasBody ? JSON.stringify(body) : undefined,
        signal: controller ? controller.signal : undefined
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  // Grava (ou remove, quando value === null) um caminho no Realtime Database.
  // Com WebSocket ativo usa o SDK; sem conexão em tempo real (ou se o SDK não confirmar) usa HTTPS.
  async writeRemote(path, value) {
    if (this.isConnected && this.db) {
      let timer = null;
      try {
        const op = value === null ? remove(ref(this.db, path)) : set(ref(this.db, path), value);
        const timeout = new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('sdk-timeout')), SDK_WRITE_TIMEOUT_MS);
        });
        await Promise.race([op, timeout]);
        return true;
      } catch (err) {
        if (!err || err.message !== 'sdk-timeout') throw err;
        console.warn('SDK do Firebase não confirmou a gravação; reenviando via HTTPS:', path);
      } finally {
        if (timer) clearTimeout(timer);
      }
    }

    if (value === null) {
      await this.restRequest('DELETE', path);
    } else {
      await this.restRequest('PUT', path, value);
    }
    return true;
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

    let stopped = false;
    let restTimer = null;
    let graceTimer = null;

    const dispatchSchedules = (data) => {
      if (data && typeof data === 'object' && onSchedules) {
        onSchedules(normalizeScheduleMap(data));
      }
    };
    const dispatchEmployees = (data) => {
      if (data && onEmployees) {
        const arr = normalizeEmployeeList(data);
        if (arr.length > 0) onEmployees(arr);
      }
    };
    const dispatchSettings = (data) => {
      if (data && typeof data === 'object' && onSettings) onSettings(data);
    };

    // Leitura periódica via HTTPS enquanto o WebSocket não estiver conectado
    const pollOnce = async () => {
      try {
        const [schedulesData, employeesData, settingsData] = await Promise.all([
          this.restRequest('GET', 'scadahub_schedules'),
          this.restRequest('GET', 'scadahub_employees'),
          this.restRequest('GET', 'scadahub_settings')
        ]);
        if (stopped || this.isConnected) return;
        dispatchSchedules(schedulesData);
        dispatchEmployees(employeesData);
        dispatchSettings(settingsData);
        if (onConnectionStatus) onConnectionStatus(true, 'rest_fallback');
      } catch (err) {
        console.warn('Falha na sincronização HTTPS de contingência:', err);
        if (!stopped && !this.isConnected && onConnectionStatus) {
          onConnectionStatus(false, 'rest_error');
        }
      }
    };

    const startRestFallback = () => {
      if (stopped || restTimer) return;
      console.warn('WebSocket do Firebase indisponível: sincronizando via HTTPS.');
      pollOnce();
      restTimer = setInterval(pollOnce, REST_POLL_INTERVAL_MS);
    };

    const stopRestFallback = () => {
      if (restTimer) {
        clearInterval(restTimer);
        restTimer = null;
      }
    };

    const armRestFallback = () => {
      if (stopped || graceTimer || restTimer) return;
      graceTimer = setTimeout(() => {
        graceTimer = null;
        if (!this.isConnected) startRestFallback();
      }, REST_FALLBACK_GRACE_MS);
    };

    const disarmRestFallback = () => {
      if (graceTimer) {
        clearTimeout(graceTimer);
        graceTimer = null;
      }
      stopRestFallback();
    };

    try {
      // 1. Monitora status de conexão real do Firebase
      const connectedRef = ref(this.db, '.info/connected');
      const unsubConnected = onValue(connectedRef, (snap) => {
        const isOnline = snap.val() === true;
        this.isConnected = isOnline;
        if (isOnline) {
          disarmRestFallback();
        } else {
          armRestFallback();
        }
        if (onConnectionStatus) {
          onConnectionStatus(isOnline, isOnline ? 'online' : 'connecting');
        }
      });
      armRestFallback();

      const onListenerError = (err) => {
        console.warn('Ouvinte do Firebase cancelado:', err);
        armRestFallback();
      };

      // 2. Escala compartilhada (Schedules)
      const schedulesRef = ref(this.db, 'scadahub_schedules');
      const unsubSchedules = onValue(schedulesRef, (snapshot) => {
        if (snapshot.exists()) dispatchSchedules(snapshot.val());
      }, onListenerError);

      // 3. Equipe (Employees)
      const employeesRef = ref(this.db, 'scadahub_employees');
      const unsubEmployees = onValue(employeesRef, (snapshot) => {
        if (snapshot.exists()) dispatchEmployees(snapshot.val());
      }, onListenerError);

      // 4. Configurações & Regras
      const settingsRef = ref(this.db, 'scadahub_settings');
      const unsubSettings = onValue(settingsRef, (snapshot) => {
        if (snapshot.exists()) dispatchSettings(snapshot.val());
      }, onListenerError);

      // Retorna função de limpeza (unsubscribe)
      return () => {
        stopped = true;
        disarmRestFallback();
        unsubConnected();
        unsubSchedules();
        unsubEmployees();
        unsubSettings();
      };
    } catch (err) {
      console.warn('Erro ao registrar ouvintes do Firebase:', err);
      stopped = true;
      disarmRestFallback();
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
      await this.writeRemote(`scadahub_schedules/${dateStr}/${key}`, slotData);
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
      await this.writeRemote(`scadahub_schedules/${dateStr}/${slotId}`, null);
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
      await this.writeRemote(`scadahub_schedules/${dateStr}`, payload);
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
      await this.writeRemote('scadahub_schedules', Object.keys(cleanMap).length > 0 ? cleanMap : null);
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
      await this.writeRemote(`scadahub_employees/${empId}`, employeeData);
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
      await this.writeRemote(`scadahub_employees/${empId}`, null);
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
      await this.writeRemote('scadahub_employees', payload);
      return true;
    } catch (err) {
      console.error('Erro ao enviar funcionários:', err);
      return false;
    }
  }

  // Leitura pontual de um caminho: SDK quando conectado; HTTPS caso contrário (ou se o SDK falhar)
  async readRemote(path) {
    if (this.isConnected && this.db) {
      try {
        const snap = await get(ref(this.db, path));
        return snap.exists() ? snap.val() : null;
      } catch (err) {
        console.warn('Leitura via SDK falhou; tentando via HTTPS:', path, err);
      }
    }
    return this.restRequest('GET', path);
  }

  // Busca lista de colaboradores diretamente no Firebase Realtime Database
  async getEmployees() {
    if (!this.isInitialized || !this.db) {
      this.init();
    }
    if (!this.db) return null;
    try {
      const val = await this.readRemote('scadahub_employees');
      const arr = normalizeEmployeeList(val);
      return arr.length > 0 ? arr : null;
    } catch (err) {
      console.warn('Erro ao buscar funcionários do Firebase RTDB:', err);
      return null;
    }
  }

  // Salva configurações operacionais (Exclusivo Admin)
  async pushSettings(settings) {
    if (!this.isInitialized || !this.db) return false;
    try {
      await this.writeRemote('scadahub_settings', settings);
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
      return (await this.readRemote(`scadahub_admins/${uid}`)) === true;
    } catch (e) {
      return false;
    }
  }

  async getUserRecord(uid) {
    if (!this.isInitialized || !this.db || !uid) return null;
    try {
      return (await this.readRemote(`scadahub_users/${uid}`)) || null;
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
