import { createHash, randomInt } from 'node:crypto';

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/** 6-digit numeric code, 100000-999999 */
export const generateOtp = () => randomInt(100000, 1000000).toString();
