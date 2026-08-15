import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

import { LeagueRegistration } from './entities/league-registration.entity';
import { LeagueSeason } from './entities/league-season.entity';

/**
 * Column layout of the league's "Rep Sports Engine import format" sheet.
 * The header text, order and the mm-dd-yy date format are what the league's
 * importer matches on, so none of it is cosmetic — do not "tidy" it.
 * Note the trailing space in 'No ': it is in the file the league supplies.
 */
const HEADERS = [
  'No ',
  'Team Name',
  'Team Role',
  'First Name',
  'Last Name',
  'Email',
  'Date of Birth',
  'Gender',
  'Phone',
  'Address 1',
  'City',
  'State/Province',
  'Zip',
  'Country',
];

const WIDTHS = [
  3.86, 14.43, 10.29, 13, 16, 30.43, 17.71, 7, 13.14, 26.14, 12.71, 13.29,
  11.71, 8.71,
];

/** Columns the supplied sheet centres. */
const CENTRED = [1, 7, 8, 9, 11, 12, 13];

export interface RosterIssue {
  registrationId: number;
  player: string;
  missing: string[];
}

@Injectable()
export class LeagueExportService {
  /**
   * Fields the league importer rejects a row for. Surfaced before the file is
   * filed rather than after the league bounces it back.
   */
  validate(rows: LeagueRegistration[]): RosterIssue[] {
    const issues: RosterIssue[] = [];
    for (const r of rows) {
      const missing: string[] = [];
      if (!r.firstName) missing.push('first name');
      if (!r.lastName) missing.push('last name');
      if (!r.email || !/^\S+@\S+\.\S+$/.test(r.email)) missing.push('email');
      if (!r.dateOfBirth) missing.push('date of birth');
      if (!r.phone) missing.push('phone');
      if (!r.address1) missing.push('address');
      if (!r.city) missing.push('city');
      if (!r.postalCode) missing.push('postal code');
      if (missing.length) {
        issues.push({
          registrationId: r.id,
          player: `${r.firstName} ${r.lastName}`.trim(),
          missing,
        });
      }
    }
    return issues;
  }

  async build(
    season: LeagueSeason,
    rows: LeagueRegistration[],
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Excel Pro Soccer Academy';
    const sheet = workbook.addWorksheet('Rep Sports Engine import format');

    sheet.addRow(HEADERS);
    const header = sheet.getRow(1);
    header.font = { bold: true, name: 'Calibri', size: 11 };
    // The supplied file leaves the 'No ' header unbolded; matched exactly so
    // a diff against the league's own template comes back clean.
    header.getCell(1).font = { bold: false, name: 'Calibri', size: 11 };
    CENTRED.forEach((i) => {
      header.getCell(i).alignment = { horizontal: 'center' };
    });
    WIDTHS.forEach((w, i) => {
      sheet.getColumn(i + 1).width = w;
    });

    const players = rows.filter((r) => r.teamRole === 'PLAYER');
    const staff = rows.filter((r) => r.teamRole !== 'PLAYER');

    const write = (r: LeagueRegistration, no: number | null) => {
      const row = sheet.addRow([
        no,
        r.teamName || `Excel Pro ${r.ageGroup}`,
        r.teamRole,
        r.firstName,
        r.lastName,
        r.email,
        r.dateOfBirth ? new Date(`${r.dateOfBirth}T00:00:00`) : null,
        r.gender,
        r.phone,
        r.address1,
        r.city,
        r.province,
        r.postalCode,
        r.country,
      ]);
      row.getCell(7).numFmt = 'mm-dd-yy';
      CENTRED.forEach((i) => {
        row.getCell(i).alignment = { horizontal: 'center' };
      });
    };

    players.forEach((r, i) => write(r, i + 1));

    // The league's own file separates staff from players with two blank rows
    // and leaves their No blank.
    if (staff.length) {
      sheet.addRow([]);
      sheet.addRow([]);
      staff.forEach((r) => write(r, null));
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  filename(season: LeagueSeason, ageGroup?: string): string {
    const safe = (s: string) => s.replace(/[^\w\- ]/g, '').trim();
    const parts = [
      ageGroup ? safe(ageGroup) : 'All age groups',
      safe(season.name),
    ];
    return `${parts.join(' - ')}.xlsx`;
  }
}
