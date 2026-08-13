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
