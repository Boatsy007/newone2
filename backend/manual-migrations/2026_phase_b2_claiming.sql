-- Phase B2 — Club & League Claiming Platform. Fully additive + idempotent.
-- Creates NEW tables only. Does not alter, rename or drop any existing table
-- or column. Safe to run repeatedly (CREATE TABLE/INDEX IF NOT EXISTS).

-- ── Platform users (end users; distinct from admin_users) ────────────────────
CREATE TABLE IF NOT EXISTS "platform_users" (
  "id"            TEXT PRIMARY KEY,
  "email"         TEXT NOT NULL,
  "name"          TEXT,
  "phone"         TEXT,
  "passwordHash"  TEXT,
  "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  "lastLoginAt"   TIMESTAMP(3),
  "deletedAt"     TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "platform_users_email_key" ON "platform_users" ("email");
CREATE INDEX IF NOT EXISTS "platform_users_deletedAt_idx" ON "platform_users" ("deletedAt");

-- ── Club claims ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "club_claims" (
  "id"            TEXT PRIMARY KEY,
  "clubId"        TEXT NOT NULL,
  "clubName"      TEXT NOT NULL,
  "applicantName" TEXT NOT NULL,
  "email"         TEXT NOT NULL,
  "phone"         TEXT,
  "role"          TEXT NOT NULL,
  "reason"        TEXT NOT NULL,
  "status"        TEXT NOT NULL DEFAULT 'PENDING',
  "submittedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedBy"    TEXT,
  "reviewNotes"   TEXT,
  "approvedAt"    TIMESTAMP(3),
  "deletedAt"     TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "club_claims_clubId_idx" ON "club_claims" ("clubId");
CREATE INDEX IF NOT EXISTS "club_claims_status_idx" ON "club_claims" ("status");
CREATE INDEX IF NOT EXISTS "club_claims_email_idx" ON "club_claims" ("email");

-- ── League claims ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "league_claims" (
  "id"            TEXT PRIMARY KEY,
  "leagueId"      TEXT NOT NULL,
  "leagueName"    TEXT NOT NULL,
  "applicantName" TEXT NOT NULL,
  "email"         TEXT NOT NULL,
  "phone"         TEXT,
  "role"          TEXT NOT NULL,
  "reason"        TEXT NOT NULL,
  "status"        TEXT NOT NULL DEFAULT 'PENDING',
  "submittedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedBy"    TEXT,
  "reviewNotes"   TEXT,
  "approvedAt"    TIMESTAMP(3),
  "deletedAt"     TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "league_claims_leagueId_idx" ON "league_claims" ("leagueId");
CREATE INDEX IF NOT EXISTS "league_claims_status_idx" ON "league_claims" ("status");
CREATE INDEX IF NOT EXISTS "league_claims_email_idx" ON "league_claims" ("email");

-- ── Club memberships (role-based ownership) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS "club_memberships" (
  "id"        TEXT PRIMARY KEY,
  "clubId"    TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "role"      TEXT NOT NULL DEFAULT 'VIEWER',
  "status"    TEXT NOT NULL DEFAULT 'ACTIVE',
  "invitedBy" TEXT,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "club_memberships_clubId_userId_key" ON "club_memberships" ("clubId", "userId");
CREATE INDEX IF NOT EXISTS "club_memberships_userId_idx" ON "club_memberships" ("userId");
CREATE INDEX IF NOT EXISTS "club_memberships_clubId_idx" ON "club_memberships" ("clubId");

-- ── Club profiles (extended editable data + verification + flags + billing) ──
CREATE TABLE IF NOT EXISTS "club_profiles" (
  "id"                TEXT PRIMARY KEY,
  "clubId"            TEXT NOT NULL,
  "ground"            TEXT,
  "address"           TEXT,
  "googleMapsUrl"     TEXT,
  "websiteUrl"        TEXT,
  "facebookUrl"       TEXT,
  "instagramUrl"      TEXT,
  "tiktokUrl"         TEXT,
  "youtubeUrl"        TEXT,
  "email"             TEXT,
  "phone"             TEXT,
  "trainingNights"    TEXT,
  "homeCourt"         TEXT,
  "clubColours"       TEXT,
  "history"           TEXT,
  "foundedYear"       INTEGER,
  "committee"         TEXT,
  "president"         TEXT,
  "secretary"         TEXT,
  "coach"             TEXT,
  "assistantCoach"    TEXT,
  "uniformPhotos"     TEXT,
  "gallery"           TEXT,
  "partnerLogos"      TEXT,
  "membershipLink"    TEXT,
  "volunteerLink"     TEXT,
  "verified"          BOOLEAN NOT NULL DEFAULT false,
  "verifiedAt"        TIMESTAMP(3),
  "verifiedBy"        TEXT,
  "verificationNotes" TEXT,
  "premium"           BOOLEAN NOT NULL DEFAULT false,
  "featured"          BOOLEAN NOT NULL DEFAULT false,
  "hidden"            BOOLEAN NOT NULL DEFAULT false,
  "suspended"         BOOLEAN NOT NULL DEFAULT false,
  "archived"          BOOLEAN NOT NULL DEFAULT false,
  "imported"          BOOLEAN NOT NULL DEFAULT false,
  "playhqManaged"     BOOLEAN NOT NULL DEFAULT false,
  "manualOverride"    BOOLEAN NOT NULL DEFAULT false,
  "plan"              TEXT,
  "trialStatus"       TEXT,
  "billingStatus"     TEXT,
  "renewalDate"       TIMESTAMP(3),
  "customerId"        TEXT,
  "subscriptionId"    TEXT,
  "deletedAt"         TIMESTAMP(3),
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "club_profiles_clubId_key" ON "club_profiles" ("clubId");

-- ── League profiles ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "league_profiles" (
  "id"                TEXT PRIMARY KEY,
  "leagueId"          TEXT NOT NULL,
  "history"           TEXT,
  "headOffice"        TEXT,
  "websiteUrl"        TEXT,
  "facebookUrl"       TEXT,
  "instagramUrl"      TEXT,
  "tiktokUrl"         TEXT,
  "youtubeUrl"        TEXT,
  "committee"         TEXT,
  "president"         TEXT,
  "secretary"         TEXT,
  "operationsManager" TEXT,
  "logoUrl"           TEXT,
  "heroImageUrl"      TEXT,
  "contactEmail"      TEXT,
  "phone"             TEXT,
  "region"            TEXT,
  "verified"          BOOLEAN NOT NULL DEFAULT false,
  "verifiedAt"        TIMESTAMP(3),
  "verifiedBy"        TEXT,
  "verificationNotes" TEXT,
  "premium"           BOOLEAN NOT NULL DEFAULT false,
  "featured"          BOOLEAN NOT NULL DEFAULT false,
  "hidden"            BOOLEAN NOT NULL DEFAULT false,
  "suspended"         BOOLEAN NOT NULL DEFAULT false,
  "archived"          BOOLEAN NOT NULL DEFAULT false,
  "imported"          BOOLEAN NOT NULL DEFAULT false,
  "playhqManaged"     BOOLEAN NOT NULL DEFAULT false,
  "manualOverride"    BOOLEAN NOT NULL DEFAULT false,
  "plan"              TEXT,
  "trialStatus"       TEXT,
  "billingStatus"     TEXT,
  "renewalDate"       TIMESTAMP(3),
  "customerId"        TEXT,
  "subscriptionId"    TEXT,
  "deletedAt"         TIMESTAMP(3),
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "league_profiles_leagueId_key" ON "league_profiles" ("leagueId");

-- ── Sponsors ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "sponsors" (
  "id"           TEXT PRIMARY KEY,
  "scope"        TEXT NOT NULL DEFAULT 'CLUB',
  "clubId"       TEXT,
  "leagueId"     TEXT,
  "name"         TEXT NOT NULL,
  "websiteUrl"   TEXT,
  "logoUrl"      TEXT,
  "description"  TEXT,
  "tier"         TEXT,
  "startDate"    TIMESTAMP(3),
  "endDate"      TIMESTAMP(3),
  "active"       BOOLEAN NOT NULL DEFAULT true,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "deletedAt"    TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "sponsors_clubId_idx" ON "sponsors" ("clubId");
CREATE INDEX IF NOT EXISTS "sponsors_leagueId_idx" ON "sponsors" ("leagueId");
CREATE INDEX IF NOT EXISTS "sponsors_scope_idx" ON "sponsors" ("scope");

-- ── Media library (references only) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "media_assets" (
  "id"           TEXT PRIMARY KEY,
  "scope"        TEXT NOT NULL DEFAULT 'CLUB',
  "clubId"       TEXT,
  "leagueId"     TEXT,
  "kind"         TEXT NOT NULL,
  "url"          TEXT NOT NULL,
  "title"        TEXT,
  "mimeType"     TEXT,
  "sizeBytes"    INTEGER,
  "width"        INTEGER,
  "height"       INTEGER,
  "uploadedBy"   TEXT,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "deletedAt"    TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "media_assets_clubId_idx" ON "media_assets" ("clubId");
CREATE INDEX IF NOT EXISTS "media_assets_leagueId_idx" ON "media_assets" ("leagueId");
CREATE INDEX IF NOT EXISTS "media_assets_kind_idx" ON "media_assets" ("kind");

-- ── Club invitations ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "club_invitations" (
  "id"         TEXT PRIMARY KEY,
  "clubId"     TEXT NOT NULL,
  "email"      TEXT NOT NULL,
  "role"       TEXT NOT NULL DEFAULT 'CONTRIBUTOR',
  "token"      TEXT NOT NULL,
  "status"     TEXT NOT NULL DEFAULT 'PENDING',
  "invitedBy"  TEXT,
  "expiresAt"  TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "deletedAt"  TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "club_invitations_token_key" ON "club_invitations" ("token");
CREATE INDEX IF NOT EXISTS "club_invitations_clubId_idx" ON "club_invitations" ("clubId");
CREATE INDEX IF NOT EXISTS "club_invitations_email_idx" ON "club_invitations" ("email");
CREATE INDEX IF NOT EXISTS "club_invitations_status_idx" ON "club_invitations" ("status");

-- ── Notifications ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "platform_notifications" (
  "id"         TEXT PRIMARY KEY,
  "userId"     TEXT,
  "type"       TEXT NOT NULL,
  "title"      TEXT NOT NULL,
  "body"       TEXT,
  "entityType" TEXT,
  "entityId"   TEXT,
  "read"       BOOLEAN NOT NULL DEFAULT false,
  "readAt"     TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "platform_notifications_userId_idx" ON "platform_notifications" ("userId");
CREATE INDEX IF NOT EXISTS "platform_notifications_read_idx" ON "platform_notifications" ("read");

-- ── Field-level change log ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "profile_change_logs" (
  "id"            TEXT PRIMARY KEY,
  "actorType"     TEXT NOT NULL DEFAULT 'USER',
  "actorId"       TEXT,
  "entityType"    TEXT NOT NULL,
  "entityId"      TEXT NOT NULL,
  "field"         TEXT NOT NULL,
  "previousValue" TEXT,
  "newValue"      TEXT,
  "ipAddress"     TEXT,
  "userAgent"     TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "profile_change_logs_entity_idx" ON "profile_change_logs" ("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "profile_change_logs_actorId_idx" ON "profile_change_logs" ("actorId");
CREATE INDEX IF NOT EXISTS "profile_change_logs_createdAt_idx" ON "profile_change_logs" ("createdAt");
