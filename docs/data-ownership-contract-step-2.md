# Step 2 — Canonical IDs and Data Ownership

This document is the binding data contract for PlayFooty integration work after Step 1.

## Identity rules

1. `leagues.id` is the permanent canonical `leagueId`.
2. `clubs.id` is the permanent canonical `clubId`.
3. `canonical_players.id` is the permanent canonical `playerId`.
4. Fixture, result, ladder, ranking, article, follow, notification and share-card relationships must use these IDs.
5. Names are display snapshots only. A name change must never break a relationship.
6. External IDs belong in mapping/provenance fields and never replace internal UUIDs.

## Canonical field ownership

### League

The core `leagues` row owns:

- name and short name
- state and association
- enabled, active, archived and approval state
- strength calculation and manual strength override
- current season and sport
- primary source and external-source metadata
- public logo, description, website, Facebook and region

`league_profiles` owns only extended self-managed fields that are not already present on `leagues`, including:

- history
- office/contact details
- additional social channels
- committee and officials
- hero media
- verification and commercial flags

Where both tables currently contain the same field, the public API must prefer the core `leagues` value. A later cleanup may remove duplicate extension fields after all consumers are migrated.

### Club

The core `clubs` row owns:

- canonical name and slug
- state, town, region and coordinates
- logo and colours
- public description
- website, Facebook, Instagram and contact email
- sport, active/archive/approval state and source provenance

`club_profiles` owns only extended self-managed fields, including:

- ground and address
- additional contact information
- training and home-ground details
- history and founded year
- committee and officials
- gallery, uniforms, partners and membership links
- verification and commercial flags

Where both tables contain the same field, the public API must prefer the core `clubs` value.

### Player

`canonical_players` owns permanent player identity and profile-level fields:

- canonical name
- normalised matching name
- current club and league references
- photo and biography

`football_goal_kickers` owns season/grade statistics only:

- season
- grade
- goals
- matches
- source provenance

`football_goal_kickers.playerName`, `clubName` and `leagueName` remain immutable display snapshots. `playerId`, `clubId` and `leagueId` are the relationship keys.

## Imported football data

### Ladders

- `leagueId` identifies the league.
- `clubId` identifies the club.
- `clubName` is a source/display snapshot.
- A verified ladder row must have a `clubId`.

### Fixtures and results

- `leagueId`, `homeClubId` and `awayClubId` identify relationships.
- Home and away names are source/display snapshots.
- A published result must have both club IDs.
- Results should link to an existing fixture by stable match identity in the later fixtures/results integration step.

### Goal kickers

- `playerId`, `clubId` and `leagueId` identify relationships.
- OCR-approved rows must resolve a stable player ID.
- The player profile route must migrate from seasonal goal-kicker row IDs to canonical player IDs.

## Write rules

1. Admin writes must validate that supplied IDs exist and are active unless explicitly restoring archived data.
2. Imports may stage name-only rows, but cannot mark them verified or published until IDs are resolved.
3. Renaming a league, club or player updates only the canonical entity and future snapshots; historical snapshots remain intact.
4. Merge operations must repoint IDs and retain aliases and audit history.
5. No frontend route should construct identity from a name or array position.

## Verification

After migrations run:

```bash
npm --prefix backend run db:verify:canonical-ids
```

The verifier fails when:

- an OCR goal-kicker row lacks `playerId`
- a published result lacks home or away club IDs
- a verified ladder row lacks `clubId`
- duplicate canonical player identities exist
- canonical league or club IDs are missing

## Remaining integration work

This step establishes the database identity foundation. The next vertical integration steps must:

- return canonical `playerId` from goal-kicker APIs
- route `/player/:playerId` through `canonical_players`
- make goal-kicker imports upsert by `playerId + season + grade`
- consolidate club and league profile reads around the ownership rules above
- ensure all public APIs prefer ID-linked records over name-only rows
