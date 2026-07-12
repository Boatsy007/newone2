-- Phase B7 — Championship Qualification & Tournament Engine. Additive + idempotent.
-- New tables only; no ranking/history table altered. Championship + invitation
-- history is permanent (soft-archive only). Safe to run repeatedly.

CREATE TABLE IF NOT EXISTS "championships" (
  "id"                  TEXT PRIMARY KEY,
  "name"                TEXT NOT NULL,
  "slug"                TEXT NOT NULL,
  "year"                INTEGER,
  "division"            TEXT NOT NULL DEFAULT 'OPEN',
  "grade"               TEXT,
  "season"              TEXT,
  "status"              TEXT NOT NULL DEFAULT 'DRAFT',
  "maxTeams"            INTEGER NOT NULL DEFAULT 16,
  "qualificationCutoff" INTEGER,
  "description"         TEXT,
  "venueId"             TEXT,
  "startDate"           TIMESTAMP(3),
  "endDate"             TIMESTAMP(3),
  "archivedAt"          TIMESTAMP(3),
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "championships_slug_key" ON "championships" ("slug");
CREATE INDEX IF NOT EXISTS "championships_status_idx" ON "championships" ("status");
CREATE INDEX IF NOT EXISTS "championships_year_idx" ON "championships" ("year");

CREATE TABLE IF NOT EXISTS "qualification_rules" (
  "id"             TEXT PRIMARY KEY,
  "championshipId" TEXT NOT NULL,
  "method"         TEXT NOT NULL,
  "priority"       INTEGER NOT NULL DEFAULT 0,
  "quota"          INTEGER,
  "params"         TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "qualification_rules_championshipId_idx" ON "qualification_rules" ("championshipId");

CREATE TABLE IF NOT EXISTS "qualification_snapshots" (
  "id"             TEXT PRIMARY KEY,
  "championshipId" TEXT NOT NULL,
  "runId"          TEXT,
  "weekLabel"      TEXT,
  "season"         TEXT,
  "data"           TEXT NOT NULL,
  "generatedBy"    TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "qualification_snapshots_championshipId_idx" ON "qualification_snapshots" ("championshipId");

CREATE TABLE IF NOT EXISTS "qualified_clubs" (
  "id"             TEXT PRIMARY KEY,
  "championshipId" TEXT NOT NULL,
  "clubId"         TEXT NOT NULL,
  "clubName"       TEXT NOT NULL,
  "method"         TEXT NOT NULL,
  "status"         TEXT NOT NULL DEFAULT 'QUALIFIED',
  "order"          INTEGER NOT NULL DEFAULT 0,
  "state"          TEXT,
  "leagueId"       TEXT,
  "leagueName"     TEXT,
  "snapshotRank"   INTEGER,
  "snapshotRating" DOUBLE PRECISION,
  "snapshotId"     TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "qualified_clubs_championshipId_clubId_key" ON "qualified_clubs" ("championshipId", "clubId");
CREATE INDEX IF NOT EXISTS "qualified_clubs_championship_status_idx" ON "qualified_clubs" ("championshipId", "status");

CREATE TABLE IF NOT EXISTS "championship_invitations" (
  "id"             TEXT PRIMARY KEY,
  "championshipId" TEXT NOT NULL,
  "clubId"         TEXT NOT NULL,
  "clubName"       TEXT NOT NULL,
  "invitationType" TEXT NOT NULL DEFAULT 'QUALIFICATION',
  "status"         TEXT NOT NULL DEFAULT 'PENDING',
  "invitedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt"    TIMESTAMP(3),
  "reason"         TEXT,
  "notes"          TEXT,
  "invitedBy"      TEXT,
  "snapshotId"     TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "championship_invitations_championship_status_idx" ON "championship_invitations" ("championshipId", "status");
CREATE INDEX IF NOT EXISTS "championship_invitations_clubId_idx" ON "championship_invitations" ("clubId");

CREATE TABLE IF NOT EXISTS "venues" (
  "id"                 TEXT PRIMARY KEY,
  "name"               TEXT NOT NULL,
  "address"            TEXT,
  "state"              TEXT,
  "capacity"           INTEGER,
  "courtCount"         INTEGER,
  "indoorOutdoor"      TEXT,
  "contactName"        TEXT,
  "contactEmail"       TEXT,
  "contactPhone"       TEXT,
  "accommodationNotes" TEXT,
  "archivedAt"         TIMESTAMP(3),
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "championship_teams" (
  "id"             TEXT PRIMARY KEY,
  "championshipId" TEXT NOT NULL,
  "clubId"         TEXT NOT NULL,
  "clubName"       TEXT NOT NULL,
  "division"       TEXT,
  "coach"          TEXT,
  "manager"        TEXT,
  "captain"        TEXT,
  "colours"        TEXT,
  "status"         TEXT NOT NULL DEFAULT 'REGISTERED',
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "championship_teams_champ_club_div_key" ON "championship_teams" ("championshipId", "clubId", "division");
CREATE INDEX IF NOT EXISTS "championship_teams_championshipId_idx" ON "championship_teams" ("championshipId");

CREATE TABLE IF NOT EXISTS "championship_pools" (
  "id"             TEXT PRIMARY KEY,
  "championshipId" TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "championship_pools_championshipId_idx" ON "championship_pools" ("championshipId");

CREATE TABLE IF NOT EXISTS "championship_fixtures" (
  "id"             TEXT PRIMARY KEY,
  "championshipId" TEXT NOT NULL,
  "poolId"         TEXT,
  "stage"          TEXT NOT NULL DEFAULT 'POOL',
  "round"          INTEGER,
  "homeTeamId"     TEXT,
  "awayTeamId"     TEXT,
  "homeClubName"   TEXT,
  "awayClubName"   TEXT,
  "venueId"        TEXT,
  "scheduledAt"    TIMESTAMP(3),
  "status"         TEXT NOT NULL DEFAULT 'SCHEDULED',
  "homeScore"      INTEGER,
  "awayScore"      INTEGER,
  "winnerTeamId"   TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "championship_fixtures_championshipId_idx" ON "championship_fixtures" ("championshipId");
CREATE INDEX IF NOT EXISTS "championship_fixtures_champ_stage_idx" ON "championship_fixtures" ("championshipId", "stage");

CREATE TABLE IF NOT EXISTS "championship_ladders" (
  "id"             TEXT PRIMARY KEY,
  "championshipId" TEXT NOT NULL,
  "poolId"         TEXT,
  "teamId"         TEXT NOT NULL,
  "clubName"       TEXT NOT NULL,
  "played"         INTEGER NOT NULL DEFAULT 0,
  "wins"           INTEGER NOT NULL DEFAULT 0,
  "losses"         INTEGER NOT NULL DEFAULT 0,
  "draws"          INTEGER NOT NULL DEFAULT 0,
  "pointsFor"      INTEGER NOT NULL DEFAULT 0,
  "pointsAgainst"  INTEGER NOT NULL DEFAULT 0,
  "points"         INTEGER NOT NULL DEFAULT 0,
  "position"       INTEGER,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "championship_ladders_champ_pool_team_key" ON "championship_ladders" ("championshipId", "poolId", "teamId");
CREATE INDEX IF NOT EXISTS "championship_ladders_championshipId_idx" ON "championship_ladders" ("championshipId");

CREATE TABLE IF NOT EXISTS "championship_history" (
  "id"               TEXT PRIMARY KEY,
  "championshipId"   TEXT NOT NULL,
  "championshipName" TEXT NOT NULL,
  "year"             INTEGER,
  "championClubId"   TEXT,
  "championName"     TEXT,
  "runnerUpClubId"   TEXT,
  "runnerUpName"     TEXT,
  "thirdClubId"      TEXT,
  "thirdName"        TEXT,
  "finalRankings"    TEXT,
  "awards"           TEXT,
  "qualifiedClubs"   TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "championship_history_championshipId_key" ON "championship_history" ("championshipId");
