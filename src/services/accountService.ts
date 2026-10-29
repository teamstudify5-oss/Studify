import { User, UserRole } from '../types';

export interface StoredAccount {
  id: string;
  name: string;
  email: string;
  passwordHash: string; // Plain/hashed simulation for client-side storage
  role: UserRole;
  avatarInitials: string;
  institution?: string;
  joinedDate: string;
}

const ACCOUNTS_STORAGE_KEY = 'studify_registered_users_v2';
const SESSION_STORAGE_KEY = 'studify_active_session_v2';
const LEGACY_CLEANED_FLAG = 'studify_legacy_accounts_purged_v2';

// Purge any legacy demo accounts on initial run to ensure a 100% clean user base
function purgeLegacyAccounts() {
  try {
    if (!localStorage.getItem(LEGACY_CLEANED_FLAG)) {
      localStorage.removeItem('pyq_auth_user_v1');
      localStorage.removeItem('pyq_auth_user');
      localStorage.removeItem(ACCOUNTS_STORAGE_KEY);
      localStorage.removeItem(SESSION_STORAGE_KEY);
      localStorage.setItem(LEGACY_CLEANED_FLAG, 'true');
    }
  } catch (e) {
    console.error('Failed to purge legacy accounts', e);
  }
}

purgeLegacyAccounts();

function getAccounts(): StoredAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAccounts(accounts: StoredAccount[]): void {
  try {
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
  } catch (e) {
    console.error('Failed to save accounts to storage', e);
  }
}

function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (parts[0]?.slice(0, 2) || 'ST').toUpperCase();
}

export const accountService = {
  getAccountsCount(): number {
    return getAccounts().length;
  },

  getAllAccounts(): StoredAccount[] {
    return getAccounts();
  },

  accountExists(email: string): boolean {
    const normalized = email.trim().toLowerCase();
    return getAccounts().some((a) => a.email.toLowerCase() === normalized);
  },

  register(name: string, email: string, password: string, role: UserRole = 'student'): User {
    const normalizedEmail = email.trim().toLowerCase();
    const accounts = getAccounts();

    if (accounts.some((a) => a.email.toLowerCase() === normalizedEmail)) {
      throw new Error('An account with this email address already exists. Please log in.');
    }

    const initials = deriveInitials(name);
    const newAccount: StoredAccount = {
      id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: btoa(password), // obfuscation for local simulation
      role,
      avatarInitials: initials,
      institution: 'Studify Learner',
      joinedDate: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    };

    accounts.push(newAccount);
    saveAccounts(accounts);

    const user: User = {
      id: newAccount.id,
      name: newAccount.name,
      email: newAccount.email,
      role: newAccount.role,
      avatarInitials: newAccount.avatarInitials,
      institution: newAccount.institution,
      joinedDate: newAccount.joinedDate,
    };

    this.saveSession(user);
    return user;
  },

  authenticate(email: string, password: string): User {
    const normalizedEmail = email.trim().toLowerCase();
    const accounts = getAccounts();
    const found = accounts.find((a) => a.email.toLowerCase() === normalizedEmail);

    if (!found) {
      throw new Error('No account found with this email. Please check your email or sign up.');
    }

    if (found.passwordHash !== btoa(password)) {
      throw new Error('Incorrect password. Please verify your credentials or reset your password.');
    }

    const user: User = {
      id: found.id,
      name: found.name,
      email: found.email,
      role: found.role,
      avatarInitials: found.avatarInitials,
      institution: found.institution,
      joinedDate: found.joinedDate,
    };

    this.saveSession(user);
    return user;
  },

  resetPassword(email: string, newPassword: string): boolean {
    const normalizedEmail = email.trim().toLowerCase();
    const accounts = getAccounts();
    const index = accounts.findIndex((a) => a.email.toLowerCase() === normalizedEmail);

    if (index === -1) {
      throw new Error('No registered account exists with this email address.');
    }

    accounts[index].passwordHash = btoa(newPassword);
    saveAccounts(accounts);
    return true;
  },

  getActiveSession(): User | null {
    try {
      const raw = localStorage.getItem(SESSION_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  saveSession(user: User | null): void {
    try {
      if (user) {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch (e) {
      console.error('Failed to update session storage', e);
    }
  },

  clearSession(): void {
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear session', e);
    }
  },

  // Reset entire account database for fresh clean start
  resetAllAccounts(): void {
    try {
      localStorage.removeItem(ACCOUNTS_STORAGE_KEY);
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (e) {
      console.error('Failed to reset accounts', e);
    }
  },
};
