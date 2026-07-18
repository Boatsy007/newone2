# PlayFooty Step 1 — Frontend/Backend Integration Audit

Date: 18 July 2026  
Branch: `newone1`  
Purpose: trace every major feature from admin input through backend/database to the public frontend and identify the exact missing connection.

## Status definitions

- **CONNECTED** — admin write and public read use compatible records/IDs and the public page is wired.
- **PARTIAL** — major pieces exist, but the full write → derived update → frontend refresh chain is incomplete or unverified.
- **BLOCKED** — a current endpoint or runtime issue prevents the workflow from completing.
- **MISSING** — the required relationship or event system does not exist yet.

## System-wide findings

1. The frontend public routes are ID-based (`/league/:leagueId`, `/team/:clubId`, `/player/:playerId`, `/match/:kind/:matchId`) and public rankings helpers read from `/api/leagues/:id`, `/api/clubs/:id`, `/api/rankings` and related APIs.
2. Admin currently uses multiple API families:
   - `/admin/manage/*`
   - `/admin/platform/*`
   - `/admin/ocr/*`
   - screenshot-specific preview/commit routes added in later steps.
3. League and club profile editing uses `/admin/platform/leagues/:id` and `/admin/platform/clubs/:id`, while list and fallback actions also use `/admin/manage/*`. This split is a reliability risk and has already caused the club editor to hang.
4. Public league and club pages consume live API data rather than static page content. This means profile writes can update the frontend without a rebuild if the backend public responses read the same fields.
5. Derived workflows are not consistently chained. A successful import does not yet prove that ladder generation, ranking recalculation, cache invalidation, feed events and notifications all ran.
6. Article publishing has article CRUD/status endpoints, but there is no verified multi-entity relationship layer connecting an article to multiple leagues, clubs, players and matches.
7. Goal-kicker records include `clubId` and `leagueId`, but player identity remains tied to the goal-kicker row ID in parts of the frontend. A stable standalone player identity must be confirmed before player news/follows can be reliable.
8. Follow/feed/notification UI exists, but no complete server-backed event pipeline has been verified from admin change to persisted supporter update.

---

## Integration matrix

### 1. Leagues

**Admin UI**
- `src/pages/AdminWorkflow.tsx`
- League list, state filtering and league editor exist.

**Admin client**
- `admin.listFootballLeagues()` → `GET /admin/platform/football/leagues`
- `admin.getLeagueProfile(id)` → `GET /admin/platform/leagues/:id`
- `admin.updateLeagueProfile(id, payload)` → `PATCH /admin/platform/leagues/:id`
- Logo upload/remove methods exist in `src/lib/admin.ts`.
- Strength override methods exist through both profile updates and `/admin/manage/leagues/:id/strength`.

**Public frontend**
- `/league/:leagueId`
- `fetchLeague(id)` → `GET /api/leagues/:id`
- League profile renders live logo, ladder, ranked teams, strength and related content.

**Status: PARTIAL**

**Confirmed connection**
- Both admin editor and public page use the same internal league ID.
- Public league page is live-API-driven.

**Missing/unverified**
- Confirm platform update route and public API read exactly the same profile fields.
- Confirm logo upload route persists a URL returned by `/api/leagues/:id`.
- Confirm strength changes trigger ranking recalculation.
- Confirm cache invalidation after update.
- Confirm league news relations and follower events.

**Next integration fix**
- Add one league integration service that performs profile update, optional recalculation, cache invalidation and audit recording in one controlled path.

---

### 2. Clubs

**Admin UI**
- `src/pages/AdminWorkflow.tsx`
- Club list, state filter, league filter and editor exist.

**Admin client**
- `admin.listClubs(leagueId)` → `GET /admin/manage/clubs`
- `admin.getClubProfile(id)` → `GET /admin/platform/clubs/:id`
- `admin.updateClubProfile(id, payload)` → `PATCH /admin/platform/clubs/:id`
- `admin.moveClub(id, leagueId)` → `POST /admin/manage/clubs/:id/move`
- Logo upload/remove methods exist.

**Public frontend**
- `/team/:clubId`
- `fetchClub(id)` → `GET /api/clubs/:id`
- Public club model includes logo, colours, town, region, website/social links, ladder and ranking fields.

**Status: BLOCKED/PARTIAL**

**Confirmed connection**
- Public pages and admin lists use internal club IDs.
- Public club API model supports most editable profile fields.

**Current blocker**
- Detailed platform profile loading has been unreliable; a fallback was added so the UI opens from list data.

**Missing/unverified**
- Confirm update endpoint response and `/api/clubs/:id` use the same fields.
- Confirm logo upload appears in rankings, ladders, goal-kicker rows, match pages and share cards.
- Confirm moving a club changes only the intended current-season membership.
- Confirm cache invalidation and supporter events.

**Next integration fix**
- Consolidate club list/detail/update/move behind one backend club service and add an end-to-end contract test for `/admin/platform/clubs/:id` → `/api/clubs/:id`.

---

### 3. Ladder screenshot imports

**Admin UI**
- OCR upload, review and approval workflow exists.
- Only approved rows are intended to commit.

**Admin client**
- `admin.ocrParse(image, leagueId)` → `POST /admin/ocr/parse`
- `admin.ocrCommit(leagueId, entries, importId)` → `POST /admin/ocr/commit`
- OCR history/discard endpoints exist.
- Football ladder generate/compare/publish endpoints also exist under `/admin/platform/football/leagues/:id/*`.

**Public frontend**
- League profile consumes ladder rows from `/api/leagues/:id`.
- Club profile also contains current league ladder data.
- Rankings consume `/api/rankings` and `/api/top*`.

**Status: PARTIAL**

**Confirmed connection**
- OCR commits are league-ID-based.
- Public league and club pages already display live ladder structures.

**Missing/unverified**
- Whether OCR commit writes the same ladder table used by `/api/leagues/:id`.
- Whether commit automatically regenerates/publishes ladder data.
- Whether ranking recalculation occurs after a successful commit.
- Whether import history stores before/after values.
- Whether cache invalidation, feed events and notifications occur.

**Next integration fix**
- Wrap OCR commit in one transaction/orchestrator: validate → upsert ladder → publish → rerank → invalidate → emit events → audit.

---

### 4. Fixtures and results screenshot imports

**Admin UI**
- Multiple screenshot preview, editable matching, approval and safe commit pages exist at `/admin/match-images`.

**Backend**
- Screenshot parser and protected preview/commit routes were added in Step 5.
- Existing football import services and public Match Centre already exist.

**Public frontend**
- `/matches`
- `/match/:kind/:matchId`
- League pages include fixtures/results in their detail model or related backend structures.

**Status: PARTIAL**

**Confirmed connection**
- Public Match Centre and match detail routes exist.
- Admin review workflow exists.

**Missing/unverified**
- Stable fixture/result identity and update-in-place behaviour.
- Whether result commit updates an existing fixture rather than creating a duplicate.
- Automatic ladder generation and ranking recalculation after results.
- Feed events, notifications and cache invalidation.
- Whether club/league match lists read the exact same records.

**Next integration fix**
- Introduce/verify a canonical match key and a single match commit service shared by fixture and result imports.

---

### 5. Goal kickers and players

**Admin UI**
- Goal-kicker screenshot importer at `/admin/goal-kicker-images`.
- Admin Players page lists goal-kicker records.

**Admin client/data**
- `admin.listGoalKickers()` → `GET /admin/platform/goal-kickers`
- Goal-kicker row contains player name, club ID, league ID, season, grade, goals and matches.
- OCR goal-kicker routes were added in Step 6.

**Public frontend**
- `/goal-kickers`
- `/player/:playerId`
- Goal-kicker and player pages exist.

**Status: PARTIAL**

**Confirmed connection**
- Club and league IDs exist on goal-kicker records.
- Public player route is ID-based.

**Missing/unverified**
- Whether `playerId` is a stable player entity or currently the goal-kicker row ID.
- Player matching/creation across seasons and clubs.
- Per-round goal deltas needed for messages such as “kicked 7 goals”.
- Automatic player feed events and notifications.
- News relationships to a player.

**Next integration fix**
- Confirm/create canonical player records, then make goal-kicker records reference `playerId` as a foreign key.

---

### 6. Club, league and player profile screenshot imports

**Admin UI**
- `/admin/profile-images`
- Review before commit exists.

**Backend**
- Profile image OCR routes were added in Step 7.
- Club and league profile update endpoints already exist.

**Public frontend**
- League, club and player public pages exist.

**Status: PARTIAL**

**Missing/unverified**
- Exact field mapping from OCR payloads to the canonical profile tables.
- Whether officials/contact data is stored in structured fields or flattened into notes.
- Whether player-list imports update canonical players.
- Cache invalidation after profile commits.

**Next integration fix**
- Define a field ownership map and reject OCR fields that do not have an explicit canonical destination.

---

### 7. Universal imports

**Admin UI**
- `/admin/universal-imports`
- Classification and handoff to specialised importers exist.

**Backend**
- Universal classification and central history routes were added in Step 8.

**Status: PARTIAL**

**Confirmed connection**
- Handoff now carries the selected image into specialised importers.

**Missing/unverified**
- Central history does not yet prove every specialised commit is linked to one shared import/batch ID.
- Retry, correction and rollback paths need end-to-end verification.
- Derived recalculation/event status is not centrally visible.

**Next integration fix**
- Add one batch/import ID propagated into every specialised preview and commit, with child status records.

---

### 8. Rankings

**Admin client**
- `/admin/manage/rankings/rerank`
- `/admin/platform/recalculate`
- Football publish can request recalculation.

**Public frontend**
- `/api/rankings`
- `/api/top10`, `/api/top25`, `/api/top100`
- Club and league profile pages use ranking data.

**Status: PARTIAL**

**Confirmed connection**
- Public ranking APIs and pages exist.
- Admin recalculation endpoints exist.

**Missing/unverified**
- Automatic rerank trigger after ladder/results/strength changes.
- Atomicity: imports may commit while reranking fails.
- Cache invalidation and ranking-update feed events.

**Next integration fix**
- Centralise recalculation triggering and store its success/failure against the source import.

---

### 9. News

**Admin UI/client**
- Article list, edit and publish/unpublish exist.
- `/admin/platform/articles/:id`
- `/admin/platform/articles/:id/status`

**Public frontend**
- `/news`
- `/news/:slug`

**Status: PARTIAL/MISSING RELATIONSHIPS**

**Confirmed connection**
- Article CRUD/status and public news pages exist.

**Missing**
- Multi-entity relations to leagues, clubs, players and matches.
- Image upload workflow in the new simple publisher.
- Automatic appearance on related entity pages.
- Follower events and notifications.

**Next integration fix**
- Add article relation tables/endpoints and update public entity APIs to return related published articles.

---

### 10. Follows, supporter feed and notifications

**Public frontend**
- `/feed`
- `/notifications`
- Follow buttons were added to club/player/league experiences.

**Status: UNVERIFIED/PARTIAL**

**Missing/unverified**
- Server-backed persistence for all entity types.
- Central event table or event producer.
- Unseen/read state.
- Admin/import actions emitting events exactly once.
- Login/account identity behaviour.

**Next integration fix**
- Audit the follow storage and implement a central domain-event pipeline before adding more notification UI.

---

### 11. Share cards

**Public frontend**
- Share buttons and card-generation work were added across profiles, rankings, matches and articles.

**Status: PARTIAL**

**Missing/unverified**
- Every card reads canonical live data by entity ID.
- Cache invalidation for generated Open Graph/card images.
- Consistent production domain rather than preview URLs.

**Next integration fix**
- Inventory every card endpoint/component and make it call the same public entity serializer used by the visible page.

---

### 12. Reviews, audit and rollback

**Admin client**
- Review list/resolve endpoints exist.
- Audit list exists.
- Backups/create/restore endpoints exist.
- OCR history exists.

**Status: PARTIAL**

**Confirmed connection**
- Review, audit and backup primitives exist.

**Missing/unverified**
- Every new screenshot commit writes a full before/after audit entry.
- Import-level correction and partial rollback.
- Derived recalculation status and event status in history.

**Next integration fix**
- Standardise one audit payload and require it in every mutation service.

---

## Highest-priority broken connections

1. **Club profile endpoint split** — list uses `/admin/manage`, detail/update uses `/admin/platform`; currently unreliable.
2. **No single import orchestrator** — commit, publish, rerank, cache invalidation, events and audit are separate/unverified.
3. **Player identity is not yet proven canonical** — blocks reliable player follows, news and season history.
4. **News entity relationships are missing** — articles cannot yet automatically appear everywhere requested.
5. **Feed/notification event generation is not verified** — UI exists, but admin changes are not proven to create persistent updates.
6. **Cache invalidation is not centralised** — successful writes may appear stale publicly.
7. **Universal import history is not yet a complete parent/child transaction log.**

## Required integration tests

The following tests must be added during subsequent steps:

1. Update league profile in admin → `GET /api/leagues/:id` returns changed values.
2. Update club profile/logo → `GET /api/clubs/:id`, rankings and related lists return changed values.
3. Commit ladder OCR → public ladder changes and rankings recalculation completes.
4. Import fixture then result → one match record remains and public score updates.
5. Import goal-kicker update → public goal table and player profile update.
6. Publish linked article → article appears on news and every related entity page.
7. Follow club/player/league → matching domain event appears in persisted feed.
8. Generate share card after profile/ranking change → card reflects current live data.

## Step 1 conclusion

The repository is not disconnected; most major admin and frontend pieces exist. The main problem is that the integration chain is fragmented across endpoint families and derived operations. The next step must stabilise IDs and canonical data ownership before adding further UI or automation.
