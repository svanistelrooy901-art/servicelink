import { usingLocal, bookingsEnabled } from './config';
import { repository as profiles } from './repository';
import { createLocalBookingRepository } from './localBookingRepository';
import { createHttpBookingRepository } from './httpBookingRepository';
import { getSupabaseClient } from './supabase';
import type { BookingRepository } from './bookingTypes';
const unavailable = async (): Promise<never> => {
  throw new Error(
    'Booking is not enabled in this environment. Use the local demonstration while the independent booking backend is prepared.',
  );
};
export const bookingRepository: BookingRepository = usingLocal
  ? createLocalBookingRepository(window.localStorage, profiles)
  : bookingsEnabled
    ? createHttpBookingRepository(async () => {
        const { data } = await getSupabaseClient().auth.getSession();
        return data.session?.access_token ?? null;
      })
    : {
        load: unavailable,
        saveSettings: unavailable,
        addBlock: unavailable,
        removeBlock: unavailable,
        availability: unavailable,
        request: unavailable,
        manual: unavailable,
        ownerAction: unavailable,
        customerRead: unavailable,
        customerAction: unavailable,
      };
