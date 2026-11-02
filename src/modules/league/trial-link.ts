import { EntityManager, Not } from 'typeorm';
import { TrialBooking } from './entities/trial-booking.entity';

/**
 * Close the loop between a trial and the member record it turned into.
 *
 * A family who tried the academy and then registers — on /indoor, on
 * /register, or through an I-Model offer — is the same family, but the trial
 * lives in `trial_booking` and the member in `users`. Before this, nothing
 * connected them: Dashboard → Trials said "Joined" while Memberships had no
 * idea, or the reverse.
 *
 * Matches on the parent's email plus the player's first and last name
 * (case and spaces ignored), so a sibling's trial is never claimed by the
 * wrong child. Never throws: a registration must not fail over bookkeeping.
 */
export async function markTrialJoined(
  manager: EntityManager,
  who: { email: string; fullname: string; userId: number },
): Promise<void> {
  try {
    const norm = (v: string | null | undefined) =>
      (v || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const email = norm(who.email);
    if (!email || !who.userId) return;
    const repo = manager.getRepository(TrialBooking);
    const candidates = await repo.find({
      where: { status: Not('declined') },
    });
    const hits = candidates.filter(
      (t) =>
        norm(t.email) === email &&
        norm(`${t.firstName} ${t.lastName}`) === norm(who.fullname) &&
        (t.status !== 'joined' || !t.convertedUserId),
    );
    for (const t of hits) {
      t.status = 'joined';
      t.convertedUserId = who.userId;
      await repo.save(t);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`markTrialJoined failed: ${(error as Error).message}`);
  }
}
