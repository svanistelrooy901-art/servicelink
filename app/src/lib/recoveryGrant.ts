export const recoveryGrantKey = 'servicelink:recovery-user';
export const RECOVERY_GRANT_MAX_AGE_MS = 10 * 60 * 1000;

// This is a client-side UX gate, NOT an authorization boundary.
// Supabase Auth must validate the recovery code and authenticated session.
export function createRecoveryGrant(userId: string, now = Date.now()): string {
  return JSON.stringify({ userId, issuedAt: now });
}
export function isRecoveryGrantValid(
  value: string | null,
  userId: string | undefined,
  now = Date.now(),
): boolean {
  if (!value || !userId) return false;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return false;
    const grant = parsed as Record<string, unknown>;
    return (
      grant.userId === userId &&
      typeof grant.issuedAt === 'number' &&
      Number.isFinite(grant.issuedAt) &&
      grant.issuedAt <= now &&
      now - grant.issuedAt < RECOVERY_GRANT_MAX_AGE_MS
    );
  } catch {
    return false;
  }
}
export function recoveryCallbackCode(search: string, hash: string): string | null {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ''));
  if (
    query.has('error') ||
    query.has('error_description') ||
    fragment.has('error') ||
    fragment.has('error_description')
  )
    return null;
  const code = query.get('code');
  return code && code.trim() === code ? code : null;
}
