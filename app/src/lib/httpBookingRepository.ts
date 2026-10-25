import type { BookingRepository, BookingWorkspace } from './bookingTypes.ts';
export function createHttpBookingRepository(
  getToken: () => Promise<string | null>,
  request: typeof fetch = fetch,
): BookingRepository {
  const proofs = new Map<string, string>();
  const proof = (id: string) => {
    let p = proofs.get(id);
    if (!p) {
      p = Array.from(crypto.getRandomValues(new Uint8Array(32)), (v) =>
        v.toString(16).padStart(2, '0'),
      ).join('');
      proofs.set(id, p);
    }
    return p;
  };
  async function api<T>(path: string, body?: unknown, owner = false): Promise<T> {
    const token = owner ? await getToken() : null;
    if (owner && !token) throw new Error('Sign in to manage your bookings.');
    const response = await request(`/api/booking/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    });
    const result = await response.json().catch(() => ({ error: 'Booking server is unavailable.' }));
    if (!response.ok) throw new Error(result.error ?? 'Unable to update booking.');
    return result as T;
  }
  const write = (action: string, payload: unknown, revision: number) =>
    api<BookingWorkspace>('owner', { action, payload, revision }, true);
  return {
    load: () => api('workspace', undefined, true),
    saveSettings: (s, r) => write('settings', s, r),
    addBlock: (b, r) => write('block', b, r),
    removeBlock: (id, r) => write('removeBlock', { id }, r),
    availability: (slug) => api('availability', { slug }),
    request: (input) => api('request', { input, proof: proof(input.requestId) }),
    manual: (input, accept, r) =>
      write('manual', { input, proof: proof(input.requestId), accept }, r),
    ownerAction: (id, action, r, accept) => write('action', { id, action, accept }, r),
    customerRead: async (id, token) => {
      try {
        return await api('read', { id, token });
      } catch (e) {
        if (e instanceof Error && e.message === 'Booking unavailable.') return null;
        throw e;
      }
    },
    customerAction: (id, token, action) => api('customer', { id, token, action }),
  };
}
