/** Malaysia mobile numbers only; never turn arbitrary text into a contact URL. */
export function normalizeMalaysiaWhatsapp(value: string): string | null {
  const input = value.trim();
  if (!input || input.length > 40 || !/^\+?[0-9 ()-]+$/.test(input)) return null;
  let digits = input.replace(/[ ()-]/g, '');
  if (digits.startsWith('+')) {
    if (!digits.startsWith('+60')) return null;
    digits = digits.slice(3);
  } else if (digits.startsWith('60')) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  // Structural validation, not a check that the number is allocated or on WhatsApp.
  return /^1[0-9]{8,9}$/.test(digits) ? `60${digits}` : null;
}

export function malaysiaWhatsappLocal(value: string): string | null {
  return normalizeMalaysiaWhatsapp(value)?.slice(2) ?? null;
}

export function getWhatsappHref(value: string): string | null {
  const number = normalizeMalaysiaWhatsapp(value);
  return number ? `https://wa.me/${number}` : null;
}
