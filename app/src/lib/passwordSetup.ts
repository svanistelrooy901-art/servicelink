const PASSWORD_SETUP_PREFIX = 'servicelink:password-setup:';

function setupKey(userId: string) {
  return `${PASSWORD_SETUP_PREFIX}${userId}`;
}

export function markPasswordSetupPending(userId: string) {
  try {
    window.localStorage.setItem(setupKey(userId), 'pending');
  } catch {
    // The current invite still routes to setup if browser storage is unavailable.
  }
}

export function clearPasswordSetupPending(userId: string) {
  try {
    window.localStorage.removeItem(setupKey(userId));
  } catch {
    // Password completion remains authoritative even if cleanup is unavailable.
  }
}

export function isPasswordSetupPending(userId: string) {
  try {
    return window.localStorage.getItem(setupKey(userId)) === 'pending';
  } catch {
    return false;
  }
}
