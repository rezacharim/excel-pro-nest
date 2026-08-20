import { Fixture } from './entities/fixture.entity';
import { Team } from './entities/team.entity';

/**
 * Builds an iCalendar feed from a list of fixtures.
 *
 * Written by hand rather than pulled from a library: the format is a dozen
 * lines, and adding a dependency means regenerating the lockfile, which has
 * broken this project's deploys before.
 *
 * Two details that matter and are easy to get wrong:
 *
 *  - **No timezone conversion.** Kick-offs are stored as the wall-clock time
 *    the league printed. They are emitted as floating local times (no Z, no
 *    TZID), which every calendar app reads as "6:30pm wherever you are". A
 *    parent in Toronto — which is everyone here — sees 6:30pm. Converting to
 *    UTC without knowing the zone is how a game lands four hours out.
 *  - **A stable UID per game.** Calendars match events by UID, so re-publishing
 *    the feed after a venue change updates the existing entry instead of
 *    leaving the parent with two.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** "20260902T183000" — a floating local timestamp. */
const stamp = (d: Date): string =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T` +
  `${pad(d.getHours())}${pad(d.getMinutes())}00`;

/** UTC form, used only for DTSTAMP, which must be absolute. */
const stampUtc = (d: Date): string =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T` +
  `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

/** Commas, semicolons, backslashes and newlines all have meaning in iCal. */
const esc = (value: string): string =>
  (value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

/**
 * Lines longer than 75 octets must be folded, or strict parsers reject the
 * file. A leading space on the continuation line marks it as a fold.
 */
const fold = (line: string): string => {
  if (line.length <= 74) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 74));
  rest = rest.slice(74);
  while (rest.length > 73) {
    parts.push(` ${rest.slice(0, 73)}`);
    rest = rest.slice(73);
  }
  if (rest.length) parts.push(` ${rest}`);
  return parts.join('\r\n');
};

export const buildCalendar = (
  fixtures: Fixture[],
  teams: Team[],
  calendarName: string,
  now: Date = new Date(),
): string => {
  const nameFor = (f: Fixture): string => {
    const team =
      (f.teamId != null ? teams.find((t) => t.id === f.teamId) : undefined) ??
      teams.find((t) => t.ageGroup === f.ageGroup);
    return team?.displayName || `Excel Pro NY ${f.ageGroup}`;
  };

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Excel Pro Soccer Academy//Fixtures//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(calendarName)}`,
    'X-WR-TIMEZONE:America/Toronto',
    // Tells subscribing apps how often to re-check. Fixtures move midweek.
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H',
  ];

  for (const f of fixtures) {
    const start = new Date(f.kickoff);
    // Youth games run about ninety minutes including the warm-up and the walk
    // back to the car; a calendar block that ends too early is worse than one
    // that runs slightly long.
    const end = new Date(start.getTime() + 90 * 60 * 1000);
    const us = nameFor(f);
    const title = f.isHome
      ? `${us} vs ${f.opponent}`
      : `${us} at ${f.opponent}`;
    const played =
      f.ourScore != null && f.theirScore != null
        ? ` (${f.ourScore}-${f.theirScore})`
        : '';

    lines.push(
      'BEGIN:VEVENT',
      `UID:fixture-${f.id}@excelproso.com`,
      `DTSTAMP:${stampUtc(now)}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      fold(`SUMMARY:${esc(title + played)}`),
      fold(
        `DESCRIPTION:${esc(
          [
            `${f.ageGroup} · ${f.competition || 'TOSL'}`,
            f.isHome ? 'Home game' : 'Away game',
            f.venue ? `Field: ${f.venue}` : 'Field to be confirmed',
            f.notes,
            'https://www.excelproso.com/matchday',
          ]
            .filter(Boolean)
            .join('\n'),
        )}`,
      ),
      fold(`LOCATION:${esc(f.venue || 'To be confirmed')}`),
      `STATUS:${f.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`,
      // A reminder the evening before is the one that actually helps.
      'BEGIN:VALARM',
      'TRIGGER:-PT12H',
      'ACTION:DISPLAY',
      fold(`DESCRIPTION:${esc(title)} tomorrow`),
      'END:VALARM',
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  // CRLF throughout — the spec requires it and some parsers enforce it.
  return `${lines.join('\r\n')}\r\n`;
};
