import { locale, t } from './index';
import { formatMY as englishDate } from '../lib/bookingRules';
import { coverageLabels as englishCoverage } from '../lib/geography';
import type { Coverage, Service } from '../lib/types';
export function formatMY(value: string) {
  if (locale() === 'en-MY') return englishDate(value);
  return new Intl.DateTimeFormat(locale(), {
    timeZone: 'Asia/Kuala_Lumpur',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
export function coverageLabels(value: Coverage[]) {
  return englishCoverage(value).map((label) => t(label));
}
export function priceLabel(service: Service) {
  if (service.priceBasis === 'quote' || service.price === null) return t('Request a quote');
  return `${new Intl.NumberFormat(locale(), { style: 'currency', currency: 'MYR', maximumFractionDigits: 2 }).format(service.price)} / ${t(service.priceBasis)}`;
}
