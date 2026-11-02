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
  const [idPart, sig] = String(token || '')
    .trim()
    .split('.');
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

/**
 * After a trial: the link that invites the family to register for a season.
 * Signed the same way as the I-Model offer, so the registration page can
 * open with the player's details already filled in and the registration is
 * tied back to the trial.
 *
 *  - indoor  → /indoor, with the training group pre-selected
 *  - outdoor → /register (academy membership, used for the outdoor season)
 */
export const registerInviteUrl = (
  trialId: number,
  season: 'indoor' | 'outdoor',
  ageGroup?: string | null,
): string => {
  const token = inviteToken(trialId);
  if (season === 'outdoor') {
    return `${SITE}/register?src=trial&trial=${token}`;
  }
  const group = indoorGroupFor(ageGroup);
  return `${SITE}/indoor?src=trial&trial=${token}${group ? `&group=${group}` : ''}`;
};

/** "U16" or "U13-U14" → the indoor training group it belongs to. */
const indoorGroupFor = (ageGroup?: string | null): string | null => {
  const m = /U\s*(\d{1,2})/i.exec(ageGroup || '');
  if (!m) return null;
  const n = Number(m[1]);
  if (n <= 9) return 'U6-U9';
  if (n <= 12) return 'U10-U12';
  if (n <= 14) return 'U13-U14';
  return 'U15-U18';
};

/*
 * A register invitation carries its own signature, made for a different
 * purpose than the I-Model offer. Otherwise a family invited to the indoor
 * season could paste the same token into /imodel?offer=… and register for a
 * team that is by selection only.
 */
const signInvite = (trialId: number): string =>
  createHmac('sha256', `${EXCEL_PRO_JWT || 'excel-pro'}:trial-invite`)
    .update(String(trialId))
    .digest('base64url')
    .slice(0, 24);

export const inviteToken = (trialId: number): string =>
  `${trialId}.${signInvite(trialId)}`;

export const trialIdFromInviteToken = (
  token?: string | null,
): number | null => {
  const [idPart, sig] = String(token || '')
    .trim()
    .split('.');
  const id = Number(idPart);
  if (!Number.isInteger(id) || id <= 0 || !sig) return null;
  const expected = Buffer.from(signInvite(id));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given)
    ? id
    : null;
};
