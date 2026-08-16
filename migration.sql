-- ============================================================================
-- Excel Pro Soccer Academy - membership upgrade migration
--
-- HOW TO RUN: open the Supabase dashboard for this project, go to
-- "SQL Editor", paste this whole file and click "Run".
--
-- The statements are idempotent (ADD COLUMN IF NOT EXISTS), so it is safe
-- to run this file more than once. It matches the TypeORM entity
-- definitions in:
--   - src/modules/users/entities/user.entity.ts
--   - src/modules/payment/entities/payment.entity.ts
-- (synchronize is disabled in production, so these columns must be added
-- manually with this script before deploying the new code.)
-- ============================================================================

-- users: membership lifecycle fields ----------------------------------------

-- 'active' | 'on_hold' | 'stopped'
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "membershipStatus" character varying NOT NULL DEFAULT 'active';

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "holdStartedAt" timestamp NULL;

-- NULL = indefinite hold
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "holdResumeAt" timestamp NULL;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "holdNote" text NULL;

-- payments: offline payment support -----------------------------------------

-- 'stripe' | 'etransfer' | 'cash' | 'other'
ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "method" character varying NOT NULL DEFAULT 'stripe';

ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "note" text NULL;

-- announcements ---------------------------------------------------------------
-- Matches src/modules/announcements/entities/announcement.entity.ts
-- category: 'league' | 'trial' | 'news'

CREATE TABLE IF NOT EXISTS "announcement" (
  "id" SERIAL PRIMARY KEY,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "category" character varying NOT NULL,
  "ctaLabel" character varying NULL,
  "ctaUrl" character varying NULL,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

-- one-time verification codes (replaces the external Upstash Redis) ----------
CREATE TABLE IF NOT EXISTS "otp_codes" (
  "key" text PRIMARY KEY,
  "code" text NOT NULL,
  "expires_at" timestamptz NOT NULL
);

-- parent portal ---------------------------------------------------------------

-- payments: payment type ('membership' | 'league') and optional period label
ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "type" character varying NOT NULL DEFAULT 'membership';

ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "periodLabel" character varying NULL;

-- parent-portal requests (hold / installment plan)
-- Matches src/modules/portal/entities/portal-request.entity.ts
CREATE TABLE IF NOT EXISTS "portal_requests" (
  "id" SERIAL PRIMARY KEY,
  "userId" integer NOT NULL,
  "kind" character varying NOT NULL,
  "resumeAt" timestamp NULL,
  "note" text NULL,
  "totalAmount" numeric(10,2) NULL,
  "installments" integer NULL,
  "status" character varying NOT NULL DEFAULT 'pending',
  "createdAt" timestamp NOT NULL DEFAULT now()
);

-- =============================================================================
-- Round 5 — director access, collections, money dashboard, activity log
-- Safe to run more than once.
-- =============================================================================

-- Players: manual suspension, payment chasing, private notes, attendance
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "suspendedAt" timestamp NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "suspensionReason" character varying NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "suspensionNote" text NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastReminderAt" timestamp NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "remindersSent" integer NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "internalNote" text NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "attendanceStatus" character varying NOT NULL DEFAULT 'attending';

-- Admin accounts: creation date (shown in the Admins screen)
ALTER TABLE "admin" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Audit trail of every admin action
-- Matches src/modules/activity/entities/admin-activity.entity.ts
CREATE TABLE IF NOT EXISTS "admin_activity" (
  "id" SERIAL PRIMARY KEY,
  "adminId" integer NULL,
  "adminUsername" character varying NOT NULL DEFAULT 'system',
  "action" character varying NOT NULL,
  "targetType" character varying NOT NULL DEFAULT 'member',
  "targetId" integer NULL,
  "targetName" character varying NULL,
  "details" text NULL,
  "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_admin_activity_action" ON "admin_activity" ("action");
CREATE INDEX IF NOT EXISTS "IDX_admin_activity_createdAt" ON "admin_activity" ("createdAt");

-- Record of every call/email/text to a family about money
-- Matches src/modules/collections/entities/contact-log.entity.ts
CREATE TABLE IF NOT EXISTS "contact_log" (
  "id" SERIAL PRIMARY KEY,
  "userId" integer NOT NULL,
  "method" character varying NOT NULL DEFAULT 'call',
  "note" text NULL,
  "followUpAt" timestamp NULL,
  "adminUsername" character varying NOT NULL DEFAULT 'system',
  "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_contact_log_userId" ON "contact_log" ("userId");

-- Academy settings the owner can change without a developer
-- Matches src/modules/settings/entities/setting.entity.ts
CREATE TABLE IF NOT EXISTS "academy_settings" (
  "key" character varying PRIMARY KEY,
  "value" text NULL,
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

-- Round 6 — quick-add players from the dashboard
-- A walk-in signing up at the field often has no date of birth on hand, so it
-- must be optional. Existing rows are untouched.
ALTER TABLE "users" ALTER COLUMN "dateOfBirth" DROP NOT NULL;

-- Round 7 — shorter registration form, email-only communication
-- Medical / allergy information collected at sign-up (optional but important)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "medicalNotes" text NULL;
-- The player photo is now optional, and government ID is no longer collected
ALTER TABLE "users" ALTER COLUMN "photoUrl" DROP NOT NULL;
ALTER TABLE "users" ALTER COLUMN "NationalIdCard" DROP NOT NULL;
-- Address details are optional for players added by an admin
ALTER TABLE "users" ALTER COLUMN "address" DROP NOT NULL;
ALTER TABLE "users" ALTER COLUMN "city" DROP NOT NULL;
ALTER TABLE "users" ALTER COLUMN "postalCode" DROP NOT NULL;
ALTER TABLE "users" ALTER COLUMN "height" DROP NOT NULL;
ALTER TABLE "users" ALTER COLUMN "weight" DROP NOT NULL;

-- Round 8 — editable membership periods and parent invitations
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "currentSubscriptionStartDate" timestamp NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "invitedAt" timestamp NULL;

-- Round 9 — Winter League registration, installments and trials
-- Matches src/modules/league/entities/*.entity.ts
-- Safe to re-run: every statement is IF NOT EXISTS / idempotent.

-- One registration window (e.g. "Winter League 2026/27")
CREATE TABLE IF NOT EXISTS "league_season" (
  "id" SERIAL PRIMARY KEY,
  "name" text NOT NULL,
  "ageGroups" text NOT NULL DEFAULT 'U9,U10,U11,U12,U13,U14,U15,U16',
  "startsOn" date NULL,
  "firstPaymentDue" date NULL,
  "secondPaymentDue" date NULL,
  "feeTotal" numeric(10,2) NOT NULL DEFAULT 900,
  "feeLate" numeric(10,2) NOT NULL DEFAULT 1100,
  "feePayInFull" numeric(10,2) NULL,
  "capacityPerGroup" integer NOT NULL DEFAULT 18,
  "paymentInstructions" text NULL,
  "isActive" boolean NOT NULL DEFAULT true,
  "registrationOpen" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

-- One player signed up for one season. Personal details are a snapshot: the
-- roster filed with PISL/YRSL must not change when a parent edits their
-- address months later.
CREATE TABLE IF NOT EXISTS "league_registration" (
  "id" SERIAL PRIMARY KEY,
  "seasonId" integer NOT NULL,
  "userId" integer NULL,
  "ageGroup" character varying NOT NULL,
  "teamName" character varying NULL,
  "league" character varying NULL,
  "teamRole" character varying NOT NULL DEFAULT 'PLAYER',
  "firstName" character varying NOT NULL,
  "lastName" character varying NOT NULL,
  "email" character varying NOT NULL,
  "dateOfBirth" date NULL,
  "gender" character varying NOT NULL DEFAULT 'M',
  "phone" character varying NOT NULL,
  "address1" text NULL,
  "city" character varying NULL,
  "province" character varying NOT NULL DEFAULT 'ON',
  "postalCode" character varying NULL,
  "country" character varying NOT NULL DEFAULT 'Canada',
  "parentName" text NULL,
  "status" character varying NOT NULL DEFAULT 'pending_payment',
  "isLate" boolean NOT NULL DEFAULT false,
  "payInFull" boolean NOT NULL DEFAULT false,
  "feeTotal" numeric(10,2) NOT NULL DEFAULT 900,
  "firstAmount" numeric(10,2) NOT NULL DEFAULT 450,
  "firstDueDate" date NULL,
  "firstPaidAt" timestamp NULL,
  "firstPaymentId" integer NULL,
  "secondAmount" numeric(10,2) NOT NULL DEFAULT 450,
  "secondDueDate" date NULL,
  "secondPaidAt" timestamp NULL,
  "secondPaymentId" integer NULL,
  "medicalNotes" text NULL,
  "jerseySize" character varying NULL,
  "previousClub" character varying NULL,
  "consentTerms" boolean NOT NULL DEFAULT false,
  "consentPhoto" boolean NOT NULL DEFAULT false,
  "adminNote" text NULL,
  "submittedAt" timestamp NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_league_reg_season" ON "league_registration" ("seasonId");
CREATE INDEX IF NOT EXISTS "IDX_league_reg_season_age" ON "league_registration" ("seasonId", "ageGroup");
CREATE INDEX IF NOT EXISTS "IDX_league_reg_status" ON "league_registration" ("status");
CREATE INDEX IF NOT EXISTS "IDX_league_reg_user" ON "league_registration" ("userId");

-- Trial requests from players who are not academy members yet. Kept out of
-- "users" so membership and revenue figures are not distorted by people who
-- attended once and never joined.
CREATE TABLE IF NOT EXISTS "trial_booking" (
  "id" SERIAL PRIMARY KEY,
  "firstName" character varying NOT NULL,
  "lastName" character varying NOT NULL,
  "dateOfBirth" date NULL,
  "gender" character varying NULL,
  "ageGroup" character varying NOT NULL,
  "parentName" character varying NOT NULL,
  "email" character varying NOT NULL,
  "phone" character varying NOT NULL,
  "city" character varying NULL,
  "previousClub" character varying NULL,
  "position" character varying NULL,
  "preferredWhen" character varying NULL,
  "howHeard" character varying NULL,
  "scheduledFor" timestamp NULL,
  "status" character varying NOT NULL DEFAULT 'booked',
  "coachNotes" text NULL,
  "convertedUserId" integer NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_trial_status" ON "trial_booking" ("status");

-- Seed the Winter League 2026/27 season. Fees, dates and the e-transfer note
-- can all be changed later from the admin screens without a deploy.
INSERT INTO "league_season"
  ("name", "ageGroups", "startsOn", "firstPaymentDue", "secondPaymentDue",
   "feeTotal", "feeLate", "capacityPerGroup", "paymentInstructions")
SELECT 'Winter League 2026/27', 'U9,U10,U11,U12,U13,U14,U15,U16',
       DATE '2026-10-15', DATE '2026-08-25', DATE '2026-09-20',
       900, 1100, 18,
       'Send your Interac e-Transfer to Excelpro.Etransfer@gmail.com and put the player''s full name and age group in the message.'
WHERE NOT EXISTS (
  SELECT 1 FROM "league_season" WHERE "name" = 'Winter League 2026/27'
);

-- Round 10 — control over how "spots left" is shown, and an explicit
-- late-fee date.
-- "18 spots left" tells a family they can safely decide next month, which is
-- the opposite of what a payment deadline needs. These columns let the number
-- be withheld until it is genuinely low, without inventing a fake one.
ALTER TABLE "league_season" ADD COLUMN IF NOT EXISTS "capacityOverrides" text NULL;
ALTER TABLE "league_season" ADD COLUMN IF NOT EXISTS "spotsDisplay" character varying NOT NULL DEFAULT 'threshold';
ALTER TABLE "league_season" ADD COLUMN IF NOT EXISTS "spotsThreshold" integer NOT NULL DEFAULT 6;
ALTER TABLE "league_season" ADD COLUMN IF NOT EXISTS "lateFeeFrom" date NULL;

-- Existing seasons keep behaving as before unless changed.
UPDATE "league_season" SET "lateFeeFrom" = "firstPaymentDue" WHERE "lateFeeFrom" IS NULL;

-- Round 11 — a photo per announcement
-- Chosen from the Gallery (or uploaded straight into it) rather than typed as
-- a URL, so the news cards on the homepage can show a real picture.
ALTER TABLE "announcement" ADD COLUMN IF NOT EXISTS "imageUrl" text NULL;

-- Round 12 — a second program alongside the league (Indoor), addressable by
-- URL, so next season is a new row rather than a code change.
ALTER TABLE "league_season" ADD COLUMN IF NOT EXISTS "slug" character varying NULL;
ALTER TABLE "league_season" ADD COLUMN IF NOT EXISTS "kind" character varying NOT NULL DEFAULT 'league';
ALTER TABLE "league_season" ADD COLUMN IF NOT EXISTS "tagline" text NULL;
ALTER TABLE "league_season" ADD COLUMN IF NOT EXISTS "paymentCoversNote" text NULL;
ALTER TABLE "league_season" ADD COLUMN IF NOT EXISTS "newPlayerFee" numeric(10,2) NULL;
ALTER TABLE "league_season" ADD COLUMN IF NOT EXISTS "installmentCount" integer NOT NULL DEFAULT 2;
-- The parts a booking is made of, so the page can itemise them instead of
-- showing one unexplained total.
ALTER TABLE "league_season" ADD COLUMN IF NOT EXISTS "depositAmount" numeric(10,2) NULL;
ALTER TABLE "league_season" ADD COLUMN IF NOT EXISTS "firstTermAmount" numeric(10,2) NULL;
ALTER TABLE "league_season" ADD COLUMN IF NOT EXISTS "uniformFee" numeric(10,2) NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_league_season_slug" ON "league_season" ("slug") WHERE "slug" IS NOT NULL;

-- The existing Winter League keeps working, now reachable at /league.
UPDATE "league_season"
SET "slug" = 'winter-league', "kind" = 'league'
WHERE "name" = 'Winter League 2026/27' AND "slug" IS NULL;

-- Indoor Season 2026/27, served at /indoor.
--   depositAmount    every player pays this now (covers March & April)
--   firstTermAmount  a new player's first two months, charged up front
--   uniformFee       one-time kit, paid online, collected at first practice
-- Member pays 380. New player pays 380 + 380 + 75 = 835.
INSERT INTO "league_season"
  ("name", "slug", "kind", "tagline", "ageGroups", "startsOn",
   "firstPaymentDue", "lateFeeFrom", "feeTotal", "feeLate",
   "depositAmount", "firstTermAmount", "uniformFee",
   "installmentCount", "capacityPerGroup", "paymentCoversNote",
   "spotsDisplay", "spotsThreshold", "paymentInstructions", "isActive")
SELECT
  'Indoor Season 2026/27', 'indoor', 'indoor', 'Indoor Season 2026/27',
  'U5-U8,U9-U12,U13-U14,U15-U18',
  DATE '2026-10-05', DATE '2026-09-20', DATE '2026-09-20',
  380, 380,
  380, 380, 75,
  1, 20,
  'Reservation - covers March & April',
  'threshold', 6,
  'Send your Interac e-Transfer to Excelpro.Etransfer@gmail.com and put the player''s full name and age group in the message.',
  false
WHERE NOT EXISTS (SELECT 1 FROM "league_season" WHERE "slug" = 'indoor');

-- If you already ran the earlier version of Round 12, this brings that row
-- up to date. Harmless otherwise.
UPDATE "league_season"
SET "depositAmount" = 380, "firstTermAmount" = 380, "uniformFee" = 75,
    "newPlayerFee" = NULL,
    "paymentCoversNote" = 'Reservation - covers March & April'
WHERE "slug" = 'indoor' AND "depositAmount" IS NULL;
