import { useState } from 'react';
import { t } from '../i18n';
import { compressProfilePhoto } from '../lib/media';
import { mediaEnabled } from '../lib/config';
import { emptyInvoiceTemplate, invoiceFieldLimits } from '../lib/bookingRules';
import type { InvoiceTemplate } from '../lib/bookingTypes';
import { MediaImage } from './MediaImage';

const labels = {
  businessName: 'Business name',
  registration: 'Business registration',
  contact: 'Business contact',
  address: 'Business address',
  note: 'Invoice note',
};

export function InvoiceSettings({
  value = emptyInvoiceTemplate,
  onChange,
  onProcessingChange,
}: {
  value?: InvoiceTemplate;
  onChange: (value: InvoiceTemplate) => void;
  onProcessingChange: (busy: boolean) => void;
}) {
  const [error, setError] = useState('');
  return (
    <section className="panel">
      <h2>{t('Invoice template')}</h2>
      <p className="hint">
        {t(
          'These details apply to invoices for newly accepted bookings. The profile name is used when the business name is blank.',
        )}
      </p>
      {Object.entries(invoiceFieldLimits).map(([key, maxLength]) => {
        const field = key as keyof typeof labels;
        const props = {
          maxLength,
          value: value[field],
          onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            onChange({ ...value, [field]: e.target.value }),
        };
        return (
          <label key={key}>
            {t(labels[field])}
            {field === 'address' || field === 'note' ? (
              <textarea rows={2} {...props} />
            ) : (
              <input {...props} />
            )}
          </label>
        );
      })}
      {value.logo && (
        <div className="portfolio-actions">
          <MediaImage className="invoice-logo-preview" src={value.logo} alt={t('Business logo')} />
          <button
            type="button"
            className="text-btn"
            onClick={() => onChange({ ...value, logo: '' })}
          >
            {t('Remove logo')}
          </button>
        </div>
      )}
      <label>
        {t('Upload invoice logo')}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={!mediaEnabled}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            onProcessingChange(true);
            setError('');
            try {
              onChange({ ...value, logo: await compressProfilePhoto(file) });
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Unable to prepare image.');
            } finally {
              onProcessingChange(false);
            }
          }}
        />
      </label>
      {error && (
        <p className="error-text" role="alert">
          {t(error)}
        </p>
      )}
    </section>
  );
}
