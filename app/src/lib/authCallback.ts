export type AuthCallbackInput =
  | { kind: 'error'; message: string }
  | { kind: 'code'; code: string; flowId: string | null }
  | { kind: 'invite-token'; tokenHash: string }
  | { kind: 'signup-token'; tokenHash: string }
  | { kind: 'invite-session'; accessToken: string; refreshToken: string };

export function parseAuthCallback(search: string, fragment: string): AuthCallbackInput {
  const params = new URLSearchParams(search);
  const hash = new URLSearchParams(fragment.replace(/^#/, ''));
  const message =
    params.get('error_description') ??
    params.get('error') ??
    hash.get('error_description') ??
    hash.get('error');
  if (message) return { kind: 'error', message };
  const code = params.get('code');
  const tokenHash = ['invite', 'signup', 'email'].includes(params.get('type') ?? '')
    ? params.get('token_hash')
    : null;
  const accessToken = hash.get('access_token'),
    refreshToken = hash.get('refresh_token');
  const inviteSession = hash.get('type') === 'invite' && accessToken && refreshToken;
  if ([Boolean(code), Boolean(tokenHash), Boolean(inviteSession)].filter(Boolean).length !== 1) {
    return { kind: 'error', message: 'This sign-in link is invalid or has expired.' };
  }
  if (code) return { kind: 'code', code, flowId: params.get('sb_flow_id') };
  if (tokenHash)
    return { kind: params.get('type') === 'invite' ? 'invite-token' : 'signup-token', tokenHash };
  return { kind: 'invite-session', accessToken: accessToken!, refreshToken: refreshToken! };
}

interface CallbackUser {
  id: string;
  email?: string;
}
interface AuthResult {
  data: { user: CallbackUser | null };
  error: { message: string } | null;
}
export interface CallbackAuth {
  getUser(token: string): Promise<AuthResult>;
  setSession(tokens: { access_token: string; refresh_token: string }): Promise<AuthResult>;
  exchangeCodeForSession(code: string, options?: { flowId: string }): Promise<AuthResult>;
  verifyOtp(input: { token_hash: string; type: 'invite' | 'email' }): Promise<AuthResult>;
}

// A bearer token proves an account, not the recipient's intention to use that account.
// Inspect the legacy invitation account without changing the current browser session.
export async function getInvitationAccount(input: AuthCallbackInput, auth: CallbackAuth) {
  if (input.kind !== 'invite-session')
    throw new Error('This invitation does not contain a session.');
  const result = await auth.getUser(input.accessToken);
  if (result.error || !result.data.user?.email)
    throw new Error('This invitation is invalid or has expired.');
  return result.data.user;
}

export function createCallbackCompletion(input: AuthCallbackInput, auth: CallbackAuth) {
  let inFlight: Promise<AuthResult> | null = null;
  return (confirmedAccountId?: string): Promise<AuthResult> => {
    if (inFlight) return inFlight;
    inFlight = (async () => {
      if (input.kind === 'error') throw new Error(input.message);
      if (input.kind === 'invite-session') {
        if (!confirmedAccountId)
          throw new Error('Confirm the invitation account before continuing.');
        const account = await getInvitationAccount(input, auth);
        if (account.id !== confirmedAccountId)
          throw new Error('The invitation account has changed. Request a new link.');
        return auth.setSession({
          access_token: input.accessToken,
          refresh_token: input.refreshToken,
        });
      }
      if (input.kind === 'code')
        return auth.exchangeCodeForSession(
          input.code,
          input.flowId ? { flowId: input.flowId } : undefined,
        );
      return auth.verifyOtp({
        token_hash: input.tokenHash,
        type: input.kind === 'signup-token' ? 'email' : 'invite',
      });
    })();
    // Only concurrent completions are deduplicated; failed requests may be retried.
    const current = inFlight;
    current
      .finally(() => {
        if (inFlight === current) inFlight = null;
      })
      .catch(() => undefined);
    return current;
  };
}
