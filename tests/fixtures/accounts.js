// Contas fictícias para os testes (antes ficavam no authService, dentro do código publicado)
export const TEST_ACCOUNTS = {
  ADMIN: {
    uid: 'uid-admin',
    email: 'mateus.gomes@scadahub.io',
    name: 'Mateus Augusto Santos Gomes',
    employeeId: 'emp-2',
    role: 'admin',
    avatar: 'MA'
  },
  USER_A: {
    uid: 'uid-mateus-silva',
    email: 'mateus.silva@scadahub.io',
    name: 'Mateus de Oliveira Silva',
    employeeId: 'emp-1',
    role: 'user',
    avatar: 'MD'
  },
  USER_B: {
    uid: 'uid-monique',
    email: 'monique@scadahub.io',
    name: 'Monique Aparecida Hileshein',
    employeeId: 'emp-3',
    role: 'user',
    avatar: 'MH'
  },
  USER_C: {
    uid: 'uid-samara',
    email: 'samara.revoredo@scadahub.io',
    name: 'Samara Revoredo',
    employeeId: 'emp-4',
    role: 'user',
    avatar: 'SR'
  }
};

export const AUDIT_ACCOUNTS = TEST_ACCOUNTS;

// Equipe como fica no banco: a ligação com a conta Google é o e-mail
export const TEST_EMPLOYEES = Object.values(TEST_ACCOUNTS).map((acc) => ({
  id: acc.employeeId,
  name: acc.name,
  email: acc.email,
  active: true
}));

// Usuário como o Firebase Authentication entrega depois do login com Google
export const googleUser = (acc, overrides = {}) => ({
  uid: acc.uid,
  email: acc.email,
  emailVerified: true,
  displayName: acc.name,
  ...overrides
});
