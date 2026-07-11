-- Phase B8 — Sponsorship & Commercial Platform. Additive + idempotent.
-- New tables only; nothing affecting rankings. Distinct from the B2 "sponsors"
-- table. Soft-delete only. Safe to run repeatedly.

CREATE TABLE IF NOT EXISTS "commercial_sponsors" (
  "id"             TEXT PRIMARY KEY,
  "name"           TEXT NOT NULL,
  "businessName"   TEXT,
  "logoUrl"        TEXT,
  "heroImageUrl"   TEXT,
  "bannerUrl"      TEXT,
  "squareLogoUrl"  TEXT,
  "websiteUrl"     TEXT,
  "email"          TEXT,
  "phone"          TEXT,
  "description"    TEXT,
  "industry"       TEXT,
  "state"          TEXT,
  "tier"           TEXT,
  "status"         TEXT NOT NULL DEFAULT 'ACTIVE',
  "facebookUrl"    TEXT,
  "instagramUrl"   TEXT,
  "linkedinUrl"    TEXT,
  "brandPrimary"   TEXT,
  "brandSecondary" TEXT,
  "notes"          TEXT,
  "deletedAt"      TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "commercial_sponsors_status_idx" ON "commercial_sponsors" ("status");
CREATE INDEX IF NOT EXISTS "commercial_sponsors_state_idx" ON "commercial_sponsors" ("state");
CREATE INDEX IF NOT EXISTS "commercial_sponsors_industry_idx" ON "commercial_sponsors" ("industry");

CREATE TABLE IF NOT EXISTS "sponsorships" (
  "id"              TEXT PRIMARY KEY,
  "sponsorId"       TEXT NOT NULL,
  "scope"           TEXT NOT NULL DEFAULT 'CLUB',
  "clubId"          TEXT,
  "leagueId"        TEXT,
  "championshipId"  TEXT,
  "package"         TEXT,
  "tier"            TEXT,
  "status"          TEXT NOT NULL DEFAULT 'PENDING',
  "startDate"       TIMESTAMP(3),
  "endDate"         TIMESTAMP(3),
  "displayPriority" INTEGER NOT NULL DEFAULT 0,
  "bannerPosition"  TEXT,
  "ctaLabel"        TEXT,
  "ctaUrl"          TEXT,
  "trackingId"      TEXT,
  "amount"          DOUBLE PRECISION,
  "currency"        TEXT NOT NULL DEFAULT 'AUD',
  "approvedBy"      TEXT,
  "createdBy"       TEXT,
  "notes"           TEXT,
  "deletedAt"       TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "sponsorships_sponsorId_idx" ON "sponsorships" ("sponsorId");
CREATE INDEX IF NOT EXISTS "sponsorships_scope_status_idx" ON "sponsorships" ("scope", "status");
CREATE INDEX IF NOT EXISTS "sponsorships_clubId_idx" ON "sponsorships" ("clubId");
CREATE INDEX IF NOT EXISTS "sponsorships_leagueId_idx" ON "sponsorships" ("leagueId");
CREATE INDEX IF NOT EXISTS "sponsorships_championshipId_idx" ON "sponsorships" ("championshipId");
CREATE INDEX IF NOT EXISTS "sponsorships_endDate_idx" ON "sponsorships" ("endDate");

CREATE TABLE IF NOT EXISTS "sponsor_tiers" (
  "id"          TEXT PRIMARY KEY,
  "key"         TEXT NOT NULL,
  "label"       TEXT NOT NULL,
  "rank"        INTEGER NOT NULL DEFAULT 0,
  "description" TEXT,
  "benefits"    TEXT,
  "isCustom"    BOOLEAN NOT NULL DEFAULT false,
  "active"      BOOLEAN NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "sponsor_tiers_key_key" ON "sponsor_tiers" ("key");

CREATE TABLE IF NOT EXISTS "ad_inventory" (
  "id"                  TEXT PRIMARY KEY,
  "placement"           TEXT NOT NULL,
  "label"               TEXT NOT NULL,
  "priority"            INTEGER NOT NULL DEFAULT 0,
  "available"           BOOLEAN NOT NULL DEFAULT true,
  "bookingStart"        TIMESTAMP(3),
  "bookingEnd"          TIMESTAMP(3),
  "activeSponsorshipId" TEXT,
  "rotationGroup"       TEXT,
  "maxRotation"         INTEGER NOT NULL DEFAULT 1,
  "notes"               TEXT,
  "deletedAt"           TIMESTAMP(3),
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ad_inventory_placement_idx" ON "ad_inventory" ("placement");
CREATE INDEX IF NOT EXISTS "ad_inventory_available_idx" ON "ad_inventory" ("available");

CREATE TABLE IF NOT EXISTS "premium_memberships" (
  "id"               TEXT PRIMARY KEY,
  "scope"            TEXT NOT NULL,
  "entityId"         TEXT NOT NULL,
  "entityName"       TEXT,
  "premiumStatus"    TEXT NOT NULL DEFAULT 'NONE',
  "verified"         BOOLEAN NOT NULL DEFAULT false,
  "claimed"          BOOLEAN NOT NULL DEFAULT false,
  "featured"         BOOLEAN NOT NULL DEFAULT false,
  "subscriptionPlan" TEXT,
  "startedAt"        TIMESTAMP(3),
  "expiresAt"        TIMESTAMP(3),
  "renewalDate"      TIMESTAMP(3),
  "autoRenew"        BOOLEAN NOT NULL DEFAULT false,
  "benefits"         TEXT,
  "deletedAt"        TIMESTAMP(3),
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "premium_memberships_scope_entityId_key" ON "premium_memberships" ("scope", "entityId");
CREATE INDEX IF NOT EXISTS "premium_memberships_premiumStatus_idx" ON "premium_memberships" ("premiumStatus");

CREATE TABLE IF NOT EXISTS "sponsorship_events" (
  "id"            TEXT PRIMARY KEY,
  "sponsorshipId" TEXT NOT NULL,
  "fromStatus"    TEXT,
  "toStatus"      TEXT NOT NULL,
  "note"          TEXT,
  "actor"         TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "sponsorship_events_sponsorshipId_idx" ON "sponsorship_events" ("sponsorshipId");
