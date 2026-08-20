import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Setting } from './entities/setting.entity';

/**
 * The wording on the public site.
 *
 * Headings like "Latest from our Instagram" were written into the components,
 * so changing a single sentence meant a code change, a zip and a deploy. They
 * live here instead, in the key/value table the academy settings already use —
 * no new table, no migration.
 *
 * Kept separate from the SettingsController on purpose. That one is typed
 * (prices, reminder timing, suspension rules) and entirely behind a guard;
 * this one is free-form strings and has to be readable by the public site.
 * Bolting them together would mean either exposing prices or authenticating
 * the home page.
 */

/** `site.` namespaces these rows so they never collide with a real setting. */
const PREFIX = 'site.';

export const SITE_TEXT_DEFAULTS: Record<string, string> = {
  // Instagram wall
  'instagram.eyebrow': 'Follow our journey',
  'instagram.heading': 'Latest from our Instagram',
  'instagram.blurb': 'Training sessions, match days and player moments —',
  'instagram.handle': '@ExcelProSoccer',
  'instagram.url': 'https://www.instagram.com/excelprosoccer',
  // News
  'news.eyebrow': "What's happening",
  'news.heading': 'Latest from the academy',
  'news.link': 'See all news & registration',
  // Fixtures
  'fixtures.eyebrow': 'Matchday',
  'fixtures.heading': 'Next game',
  'fixtures.upcoming': 'Coming up',
  // Testimonials
  'testimonials.eyebrow': 'In their words',
  'testimonials.heading': 'What our families say',
};

@ApiTags('Site text')
@Controller('site-text')
export class SiteTextController {
  constructor(
    @InjectRepository(Setting)
    private readonly repo: Repository<Setting>,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Editable wording used on the public site' })
  async get(): Promise<Record<string, string>> {
    const out = { ...SITE_TEXT_DEFAULTS };
    try {
      const rows = await this.repo.find({ where: { key: Like(`${PREFIX}%`) } });
      for (const row of rows) {
        const key = row.key.slice(PREFIX.length);
        // A row saved as an empty string means "use the default", so the
        // academy can clear a field to get the original wording back rather
        // than having to remember what it said.
        if (key in SITE_TEXT_DEFAULTS && (row.value ?? '').trim()) {
          out[key] = row.value as string;
        }
      }
    } catch {
      // Never let a settings hiccup take the home page down — the defaults
      // are the wording that shipped, so falling back to them is harmless.
    }
    return out;
  }

  @Patch()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change the wording on the public site (admin)' })
  async update(
    @Body() patch: Record<string, string>,
  ): Promise<Record<string, string>> {
    for (const [key, value] of Object.entries(patch ?? {})) {
      // Only keys we know about. Otherwise a typo in the dashboard quietly
      // writes a row nothing ever reads.
      if (!(key in SITE_TEXT_DEFAULTS)) continue;
      await this.repo.save(
        this.repo.create({ key: `${PREFIX}${key}`, value: String(value ?? '') }),
      );
    }
    return this.get();
  }
}
