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
