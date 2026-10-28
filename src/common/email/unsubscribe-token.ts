import { createHmac, timingSafeEqual } from 'crypto';
import { EXCEL_PRO_JWT } from '../constant/jwt.const';

/**
 * One-click unsubscribe links for promotional email (CASL).
 *
 * The link carries the email address and a signature made with the server
 * secret, so nobody can unsubscribe someone else by guessing a URL, and no
 * login is needed to unsubscribe — the law requires it to be simple.
 */
const SITE = 'https://www.excelproso.com';

export const unsubscribeToken = (email: string): string =>
  createHmac('sha256', `${EXCEL_PRO_JWT || 'excel-pro'}:unsubscribe`)
    .update(email.trim().toLowerCase())
    .digest('base64url')
    .slice(0, 32);

export const verifyUnsubscribeToken = (email: string, token: string) => {
  const expected = Buffer.from(unsubscribeToken(email));
  const given = Buffer.from(String(token || ''));
  return expected.length === given.length && timingSafeEqual(expected, given);
};

export const unsubscribeUrl = (email: string): string =>
  `${SITE}/unsubscribe?e=${encodeURIComponent(email.trim().toLowerCase())}&t=${unsubscribeToken(email)}`;
