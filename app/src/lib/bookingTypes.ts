import type { Service } from './types';
export type BookingMode = 'appointment' | 'date-range';
export type BookingStatus =
  | 'requested'
  | 'accepted'
  | 'confirmed'
  | 'completed'
  | 'declined'
  | 'cancelled'
  | 'expired';
export type PaymentStatus = 'not_due' | 'unpaid' | 'claimed' | 'provider_verified';
export interface DayHours {
  day: number;
  enabled: boolean;
  start: string;
  end: string;
}
export interface TimeBlock {
  id: string;
  start: string;
  end: string;
  note: string;
}
export interface ManualPaymentDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
  instructions: string;
  qrPhoto: string;
}
export interface BookingSettings {
  enabled: boolean;
  weekly: DayHours[];
  noticeMinutes: number;
  bufferMinutes: number;
  modes: Record<string, BookingMode>;
  payment: ManualPaymentDetails;
}
export interface BookingInput {
  slug: string;
  serviceId: string;
  mode: BookingMode;
  start: string;
  end: string;
  stateId: string;
  subdivisionId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  note: string;
  consent: boolean;
  requestId: string;
}
export interface BookingRecord extends Omit<BookingInput, 'consent' | 'requestId' | 'slug'> {
  id: string;
  reference: string;
  accessToken: string;
  requestId: string;
  requestFingerprint: string;
  service: Service;
  providerName: string;
  providerWhatsapp: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  bufferMinutes: number;
  amountDueCents: number | null;
  paymentDeadline: string | null;
  paymentDetails: ManualPaymentDetails | null;
  createdAt: string;
  verifiedAt: string | null;
  refundFollowUp: boolean;
  source: 'customer' | 'provider';
  events: { at: string; action: string }[];
}
export interface BookingWorkspace {
  settings: BookingSettings;
  blocks: TimeBlock[];
  bookings: BookingRecord[];
  revision: number;
}
export interface BookingAvailability {
  settings: Pick<
    BookingSettings,
    'enabled' | 'weekly' | 'noticeMinutes' | 'bufferMinutes' | 'modes'
  >;
  busy: { start: string; end: string; bufferMinutes?: number }[];
}
export interface AcceptBooking {
  amountDueCents: number;
  paymentDeadline: string;
}
export interface BookingRepository {
  load(): Promise<BookingWorkspace>;
  saveSettings(settings: BookingSettings, revision: number): Promise<BookingWorkspace>;
  addBlock(block: Omit<TimeBlock, 'id'>, revision: number): Promise<BookingWorkspace>;
  removeBlock(id: string, revision: number): Promise<BookingWorkspace>;
  availability(slug: string): Promise<BookingAvailability>;
  request(input: BookingInput): Promise<BookingRecord>;
  manual(input: BookingInput, accept: AcceptBooking, revision: number): Promise<BookingWorkspace>;
  ownerAction(
    id: string,
    action: 'accept' | 'decline' | 'verify' | 'cancel' | 'complete',
    revision: number,
    accept?: AcceptBooking,
  ): Promise<BookingWorkspace>;
  customerRead(id: string, token: string): Promise<BookingRecord | null>;
  customerAction(id: string, token: string, action: 'claim' | 'cancel'): Promise<BookingRecord>;
}
