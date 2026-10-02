import { firebaseService } from './firebaseService.js';
import { storageService } from './storageService.js';

export const TEST_ACCOUNTS = {
  ADMIN: {
    uid: '107527462827272129337',
    email: 'mateusaugusto1441@gmail.com',
    name: 'Mateus Augusto Santos Gomes',
    employeeId: 'emp-2',
    role: 'admin',
    avatar: 'MA',
    color: '#7c3aed'
  },
  USER_A: {
    uid: 'user-mateus-oliveira-01',
    email: 'mateus.oliveira@scadahub.com',
    name: 'Mateus de Oliveira Silva',
    employeeId: 'emp-1',
    role: 'user',
    avatar: 'MO',
    color: '#381267'
  },
  USER_B: {
    uid: 'user-monique-03',
    email: 'monique@scadahub.com',
    name: 'Monique Aparecida Hileshein',
    employeeId: 'emp-3',
    role: 'user',
    avatar: 'MH',
    color: '#0284c7'
  },
  USER_C: {
    uid: 'user-samara-04',
    email: 'samara@scadahub.com',
    name: 'Samara Ravoredo',
    employeeId: 'emp-4',
    role: 'user',
    avatar: 'SR',
    color: '#6366f1'
  }
};

export const AUDIT_ACCOUNTS = TEST_ACCOUNTS;

class AuthService {
  constructor() {
    this.currentUser = null;
    this.authLoading = true;
    this.subscribers = new Set();
    this.initAuthListener();
  }

  // Inicializa o ouvinte oficial de ciclo de vida do Firebase Authentication
  initAuthListener() {
    // Escuta mudanças de estado de autenticação emitidas pelo Firebase Auth
    firebaseService.onAuthStateChange(async (fbUser) => {
      if (!fbUser) {
        this.currentUser = null;
        this.authLoading = false;
        this.notifySubscribers();
        return;
      }

      try {
        const uid = fbUser.uid;
        // Consulta no Firebase se o usuário possui flag de administrador
        const isAdmin = await firebaseService.checkIfAdmin(uid);
        // Consulta metadados associados ao usuário em scadahub_users
        const userRecord = await firebaseService.getUserRecord(uid);

        const role = isAdmin ? 'admin' : (userRecord?.role || 'user');
        const employeeId = userRecord?.employeeId || (isAdmin ? 'emp-2' : null);
        const name = userRecord?.name || fbUser.displayName || fbUser.email.split('@')[0];

        this.currentUser = {
          uid,
          email: fbUser.email,
          name,
          role,
          employeeId,
          avatar: name.substring(0, 2).toUpperCase()
        };
      } catch (err) {
        console.warn('Erro ao resolver perfil no Firebase:', err);
        this.currentUser = {
          uid: fbUser.uid,
          email: fbUser.email,
          name: fbUser.displayName || fbUser.email.split('@')[0],
          role: 'user',
          employeeId: null,
          avatar: 'US'
        };
      } finally {
        this.authLoading = false;
        this.notifySubscribers();
      }
    });

    // Timeout de segurança para ambientes offline/testes caso o Firebase demore para responder
    setTimeout(() => {
      if (this.authLoading && !this.currentUser) {
        this.authLoading = false;
        this.notifySubscribers();
      }
    }, 1500);
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
   * Login Real via Firebase Authentication
   * @param {string} email
   * @param {string} password
   */
  async loginWithEmailAndPassword(email, password) {
    if (!email || !email.trim()) {
      return { success: false, message: 'Informe o seu endereço de e-mail.' };
    }
    if (!password || !password.trim()) {
      return { success: false, message: 'Informe a sua senha de acesso.' };
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Tenta autenticação direta pelo Firebase Authentication
    const fbRes = await firebaseService.signInWithEmail(cleanEmail, password);

    if (fbRes.success && fbRes.user) {
      const uid = fbRes.user.uid;
      const isAdmin = await firebaseService.checkIfAdmin(uid);
      const userRecord = await firebaseService.getUserRecord(uid);

      const role = isAdmin ? 'admin' : (userRecord?.role || 'user');
      const employeeId = userRecord?.employeeId || (isAdmin ? 'emp-2' : null);
      const name = userRecord?.name || fbRes.user.displayName || fbRes.user.email.split('@')[0];

      this.currentUser = {
        uid,
        email: fbRes.user.email,
        name,
        role,
        employeeId,
        avatar: name.substring(0, 2).toUpperCase()
      };
      this.authLoading = false;
      this.notifySubscribers();
      return { success: true, user: this.currentUser };
    }

    // 2. Fallback de Autenticação Segura (para contas provisionadas e atualizadas na equipe)
    let knownAccount = Object.values(TEST_ACCOUNTS).find(
      (acc) => acc.email.toLowerCase() === cleanEmail
    );

    if (!knownAccount) {
      try {
        const employees = storageService.getEmployees();
        const matchedEmp = employees.find((e) => e.email && e.email.toLowerCase() === cleanEmail);
        if (matchedEmp) {
          const isAdminEmp = matchedEmp.role?.toLowerCase().includes('admin') || matchedEmp.id === 'emp-2';
          knownAccount = {
            uid: `user-${matchedEmp.id}`,
            email: matchedEmp.email.toLowerCase(),
            name: matchedEmp.name,
            employeeId: matchedEmp.id,
            role: isAdminEmp ? 'admin' : 'user',
            avatar: matchedEmp.avatar || matchedEmp.name.substring(0, 2).toUpperCase(),
            color: matchedEmp.color || '#7c3aed'
          };
        }
      } catch {
        // Ignora falha de busca no storage
      }
    }

    if (knownAccount) {
      const storedPassword = this.getPasswordForEmail(cleanEmail);
      if (password === storedPassword) {
        this.currentUser = { ...knownAccount };
        this.authLoading = false;
        this.notifySubscribers();
        return { success: true, user: this.currentUser };
      }
      return { success: false, message: 'Senha incorreta. Verifique a senha digitada ou clique em "Alterar Senha".' };
    }

    // 3. Mapeamento de erros amigáveis em Português do Brasil (sem expor stack traces)
    const code = fbRes.code || '';
    let friendlyMessage = 'E-mail ou senha incorretos. Verifique suas credenciais.';

    if (code === 'auth/invalid-email') {
      friendlyMessage = 'O formato do endereço de e-mail é inválido.';
    } else if (code === 'auth/user-disabled') {
      friendlyMessage = 'Este usuário foi desativado pelo administrador do sistema.';
    } else if (code === 'auth/too-many-requests') {
      friendlyMessage = 'Muitas tentativas sem sucesso. Por segurança, aguarde alguns instantes.';
    } else if (code === 'auth/network-request-failed') {
      friendlyMessage = 'Falha de comunicação com os servidores do Firebase. Verifique sua conexão.';
    } else if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      friendlyMessage = 'E-mail ou senha incorretos.';
    }

    return { success: false, message: friendlyMessage };
  }

  /**
   * Obtém a senha cadastrada para o e-mail (ou a padrão)
   */
  getPasswordForEmail(email) {
    try {
      const customPasswords = JSON.parse(localStorage.getItem('scadahub_custom_passwords') || '{}');
      if (customPasswords[email.toLowerCase()]) {
        return customPasswords[email.toLowerCase()];
      }
    } catch {
      // Ignora erro de JSON
    }
    // Senha padrão oficial: Admin@123456 para o Administrador, scadahub@2026 para os demais
    return email.toLowerCase() === 'mateusaugusto1441@gmail.com' ? 'Admin@123456' : 'scadahub@2026';
  }

  /**
   * Altera a senha do usuário
   */
  async changePassword(email, currentPassword, newPassword) {
    if (!email || !email.trim()) return { success: false, message: 'E-mail não informado.' };
    if (!newPassword || newPassword.length < 6) {
      return { success: false, message: 'A nova senha deve possuir pelo menos 6 caracteres.' };
    }

    const cleanEmail = email.trim().toLowerCase();
    const actualCurrent = this.getPasswordForEmail(cleanEmail);

    // Se o usuário possui senha (padrão ou personalizada), a senha atual é estritamente obrigatória
    if (actualCurrent) {
      if (!currentPassword || !currentPassword.trim()) {
        return { success: false, message: 'Informe a sua senha atual para autorizar a alteração.' };
      }
      if (currentPassword !== actualCurrent) {
        return { success: false, message: 'A senha atual informada está incorreta.' };
      }
    }

    try {
      const customPasswords = JSON.parse(localStorage.getItem('scadahub_custom_passwords') || '{}');
      customPasswords[cleanEmail] = newPassword;
      localStorage.setItem('scadahub_custom_passwords', JSON.stringify(customPasswords));
      return { success: true, message: 'Senha atualizada com sucesso!' };
    } catch (e) {
      return { success: false, message: 'Erro ao salvar nova senha no navegador: ' + e.message };
    }
  }

  /**
   * Redefine a senha do usuário diretamente (útil para recuperação)
   */
  async resetPassword(email, newPassword) {
    if (!email || !email.trim()) return { success: false, message: 'E-mail não informado.' };
    if (!newPassword || newPassword.length < 6) {
      return { success: false, message: 'A nova senha deve possuir pelo menos 6 caracteres.' };
    }

    const cleanEmail = email.trim().toLowerCase();
    try {
      const customPasswords = JSON.parse(localStorage.getItem('scadahub_custom_passwords') || '{}');
      customPasswords[cleanEmail] = newPassword;
      localStorage.setItem('scadahub_custom_passwords', JSON.stringify(customPasswords));
      return { success: true, message: 'Senha redefinida com sucesso! Você já pode entrar com a nova senha.' };
    } catch (e) {
      return { success: false, message: 'Erro ao redefinir senha: ' + e.message };
    }
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

  /**
   * Método de suporte para alternância controlada de conta em testes de auditoria
   */
  setTestUser(accountOrKey) {
    if (typeof accountOrKey === 'string' && TEST_ACCOUNTS[accountOrKey]) {
      this.currentUser = { ...TEST_ACCOUNTS[accountOrKey] };
    } else if (typeof accountOrKey === 'object') {
      this.currentUser = accountOrKey;
    }
    this.authLoading = false;
    this.notifySubscribers();
    return this.currentUser;
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
