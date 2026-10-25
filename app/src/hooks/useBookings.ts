import { useCallback, useEffect, useState } from 'react';
import { bookingRepository } from '../lib/bookingRepository';
import type { BookingWorkspace } from '../lib/bookingTypes';
export function useBookings() {
  const [data, setData] = useState<BookingWorkspace | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const refresh = useCallback(async () => {
    try {
      setData(await bookingRepository.load());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load bookings.');
    }
  }, []);
  useEffect(() => {
    refresh();
    const update = () => {
      refresh();
    };
    window.addEventListener('focus', update);
    window.addEventListener('storage', update);
    const timer = window.setInterval(update, 30000);
    return () => {
      window.removeEventListener('focus', update);
      window.removeEventListener('storage', update);
      window.clearInterval(timer);
    };
  }, [refresh]);
  async function run(task: () => Promise<BookingWorkspace>, message: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    setFeedback('');
    try {
      const result = await task();
      setData(result);
      setFeedback(message);
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update bookings.');
    } finally {
      setBusy(false);
    }
  }
  return { data, busy, error, feedback, refresh, run };
}
