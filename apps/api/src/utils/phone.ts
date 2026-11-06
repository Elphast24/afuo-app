import { BadRequestError } from './errors.js';

/**
 * Normalises a Ghana mobile number to E.164 (+233XXXXXXXXX).
 * Accepts 024 123 4567, 24-123-4567, 233241234567, +233 24 123 4567.
 * Ghana mobile numbers have 9 digits after the country code, starting with 2 or 5
 * (MTN 24/25/53/54/55/59, Telecel 20/50, AirtelTigo 26/27/56/57).
 */
export function normalizePhone(input: string): string {
  let cleaned = input.replace(/[\s\-().]/g, '');
  if (cleaned.startsWith('+')) cleaned = cleaned.slice(1);
  if (cleaned.startsWith('00')) cleaned = cleaned.slice(2);

  if (cleaned.startsWith('233')) cleaned = cleaned.slice(3);
  else if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);

  if (!/^[25]\d{8}$/.test(cleaned)) {
    throw new BadRequestError('Invalid phone number. Enter a Ghana mobile number, e.g. 024 123 4567.');
  }
  return `+233${cleaned}`;
}

export function maskPhone(phone: string): string {
  return phone.length > 6 ? `${phone.slice(0, 6)}***${phone.slice(-3)}` : phone;
}
