import { createHmac, timingSafeEqual } from 'crypto';
import { EXCEL_PRO_JWT } from '../constant/jwt.const';

/**
 * Personal registration links for the I-Model Team.
 *
 * The team is selective: a family can register only after a trial, once the
 * academy offers the player a spot (Dashboard → Trials → Offer a spot). The
 * link in that email carries the trial booking id and a signature made with
 * the server secret, so it cannot be guessed or edited to another player.
 */
const SITE = 'https://www.excelproso.com';

const sign = (trialId: number): string =>
  createHmac('sha256', `${EXCEL_PRO_JWT || 'excel-pro'}:imodel-offer`)
    .update(String(trialId))
    .digest('base64url')
    .slice(0, 24);

export const offerToken = (trialId: number): string =>
  `${trialId}.${sign(trialId)}`;

/** The trial booking id the token was made for, or null if it is not genuine. */
export const trialIdFromOfferToken = (token?: string | null): number | null => {
  const [idPart, sig] = String(token || '').trim().split('.');
  const id = Number(idPart);
  if (!Number.isInteger(id) || id <= 0 || !sig) return null;
  const expected = Buffer.from(sign(id));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given)
    ? id
    : null;
};

export const offerUrl = (trialId: number): string =>
  `${SITE}/imodel?offer=${offerToken(trialId)}`;
