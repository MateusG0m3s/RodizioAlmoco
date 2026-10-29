import { firebaseService } from './firebaseService.js';

// Só contas Google da empresa entram. O Workspace é daqhmi.com (o login do Google sai com esse e-mail);
// scadahub.io é domínio secundário do mesmo Workspace. As regras do banco (database.rules.json) recusam
// qualquer outro domínio, então esta checagem é só a da tela.
export const GOOGLE_WORKSPACE_DOMAIN = 'daqhmi.com';
export const COMPANY_DOMAINS = [GOOGLE_WORKSPACE_DOMAIN, 'scadahub.io'];

const DOMAIN_MESSAGE = `Use a sua conta Google da empresa (@${GOOGLE_WORKSPACE_DOMAIN}).`;

// Restos do login antigo por e-mail e senha: sessão local, senhas em texto puro e diretório de contas.
const LEGACY_STORAGE_KEYS = ['scadahub_local_session', 'scadahub_custom_passwords', 'scadahub_account_directory'];

function clearLegacyStorage() {
  try {
    if (typeof localStorage === 'undefined') return;
    LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Ignora ambientes sem localStorage
  }
}

export function isCompanyAccount(user) {
  const email = String(user?.email || '').toLowerCase();
  return Boolean(user && user.emailVerified && COMPANY_DOMAINS.some((domain) => email.endsWith(`@${domain}`)));
}

// A conta é ligada ao colaborador pelo e-mail cadastrado na aba Equipe; as regras do banco fazem a mesma conta
export function findEmployeeByEmail(employees, email) {
  const target = String(email || '').trim().toLowerCase();
  if (!target || !Array.isArray(employees)) return null;
  return employees.find((e) => e?.email && e.email.trim().toLowerCase() === target) || null;
}

// Sessão do app a partir do usuário do Firebase. O colaborador vem de findEmployeeByEmail no App.
export function buildSessionUser(fbUser, isAdmin) {
  const email = fbUser.email.toLowerCase();
  const name = fbUser.displayName || email.split('@')[0];
  return {
    uid: fbUser.uid,
    email,
    name,
    role: isAdmin ? 'admin' : 'user',
    employeeId: null,
    avatar: name.substring(0, 2).toUpperCase()
  };
}

// null = a pessoa fechou a janela do Google; não é erro
export function friendlyAuthError(code) {
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
      return null;
    case 'auth/popup-blocked':
      return 'O navegador bloqueou a janela do Google. Permita pop-ups para este site e tente de novo.';
    case 'auth/unauthorized-domain':
      return 'Este endereço ainda não está autorizado no Firebase. Avise o administrador.';
    case 'auth/operation-not-allowed':
      return 'O login com Google ainda não foi ativado no Firebase. Avise o administrador.';
    case 'auth/user-disabled':
      return 'Esta conta foi desativada pelo administrador do sistema.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas seguidas. Por segurança, aguarde alguns instantes.';
    case 'auth/network-request-failed':
      return 'Falha de comunicação com o Google. Verifique sua conexão.';
    default:
      return 'Não foi possível entrar com o Google. Tente novamente.';
  }
}

class AuthService {
  constructor() {
    this.currentUser = null;
    this.authLoading = true;
    this.subscribers = new Set();
    clearLegacyStorage();
    this.initAuthListener();
  }

  // Ouvinte oficial do Firebase Authentication: a sessão vale entre recarregamentos da página
  initAuthListener() {
    firebaseService.onAuthStateChange(async (fbUser) => {
      if (!fbUser) {
        this.currentUser = null;
        this.authLoading = false;
        this.notifySubscribers();
        return;
      }

      if (!isCompanyAccount(fbUser)) {
        // Encerrar a sessão dispara o ouvinte de novo, já sem usuário
        await firebaseService.signOutAuth();
        return;
      }

      // Papel de administrador vem só de /scadahub_admins/{uid}, gravado pelo console do Firebase
      const isAdmin = await firebaseService.checkIfAdmin(fbUser.uid);
      this.currentUser = buildSessionUser(fbUser, isAdmin);
      this.authLoading = false;
      this.notifySubscribers();
    });
  }

  notifySubscribers() {
    this.subscribers.forEach((cb) => {
      try {
        cb(this.currentUser, this.authLoading);
      } catch (err) {
        console.error('Erro em subscriber de auth:', err);
      }
    });
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    callback(this.currentUser, this.authLoading);
    return () => this.subscribers.delete(callback);
  }

  getCurrentUser() {
    return this.currentUser;
  }

  isLoading() {
    return this.authLoading;
  }

  isAdmin() {
    return Boolean(this.currentUser && this.currentUser.role === 'admin');
  }

  // Verifica se o usuário autenticado pode editar o slot indicado
  canEditSlot(slot) {
    if (!this.currentUser) return false;
    if (this.isAdmin()) return true;
    return Boolean(slot && slot.employeeId === this.currentUser.employeeId);
  }

  // Verifica se o usuário autenticado pode editar o funcionário
  canEditEmployee(employeeId) {
    if (!this.currentUser) return false;
    if (this.isAdmin()) return true;
    return employeeId === this.currentUser.employeeId;
  }

  canCreateEmployee() {
    return this.isAdmin();
  }

  canDeleteEmployee() {
    return this.isAdmin();
  }

  canAccessSettings() {
    return this.isAdmin();
  }

  /**
   * Login com a conta Google da empresa (janela do Google). Também serve para trocar de conta:
   * a janela sempre pergunta qual conta usar.
   */
  async loginWithGoogle() {
    const res = await firebaseService.signInWithGoogle({ hd: GOOGLE_WORKSPACE_DOMAIN });
    if (!res.success) {
      return { success: false, message: friendlyAuthError(res.code) };
    }
    if (!isCompanyAccount(res.user)) {
      // O ouvinte já encerra essa sessão
      return { success: false, message: DOMAIN_MESSAGE };
    }
    return { success: true, name: res.user.displayName || res.user.email };
  }

  /**
   * Encerramento formal da sessão via Firebase signOut()
   */
  async logout() {
    this.currentUser = null;
    await firebaseService.signOutAuth();
    this.notifySubscribers();
    return { success: true };
  }
}

export const authService = new AuthService();

// Helpers funcionais de autorização RBAC
export function canUserEditSlot(user, slot) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (!slot || !slot.employeeId) return false;
  return user.employeeId === slot.employeeId;
}

export function canUserEditEmployee(user, targetEmployeeId) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return user.employeeId === targetEmployeeId;
}

export function canUserEditEmployeeStatus(user, targetEmployeeId) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return user.employeeId === targetEmployeeId;
}

export function canUserCreateEmployee(user) {
  return Boolean(user && user.role === 'admin');
}

export function canUserDeleteEmployee(user) {
  return Boolean(user && user.role === 'admin');
}

export function canUserAccessSettings(user) {
  return Boolean(user && user.role === 'admin');
}

export function canUserResetData(user) {
  return Boolean(user && user.role === 'admin');
}
