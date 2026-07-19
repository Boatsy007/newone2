/**
 * Notification type catalogue (Phase B9).
 * Central source of truth for event types, categories, severity and recipients.
 */
export type Severity = 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL'
export type RecipientScope = 'ADMIN' | 'CLUB' | 'LEAGUE' | 'USER' | 'PLATFORM'

export interface TypeDef { type: string; label: string; category: string; severity: Severity; recipientScope: RecipientScope }

export const NOTIFICATION_TYPES: TypeDef[] = [
  // Rankings
  { type: 'RANKINGS_UPDATED',        label: 'Weekly rankings updated',         category: 'RANKINGS', severity: 'INFO',    recipientScope: 'ADMIN' },
  { type: 'CLUB_MOVED_UP',           label: 'Club moved up',                   category: 'RANKINGS', severity: 'SUCCESS', recipientScope: 'CLUB' },
  { type: 'CLUB_MOVED_DOWN',         label: 'Club moved down',                 category: 'RANKINGS', severity: 'INFO',    recipientScope: 'CLUB' },
  { type: 'CLUB_ENTERED_TOP_10',     label: 'Club entered the Top 10',         category: 'RANKINGS', severity: 'SUCCESS', recipientScope: 'CLUB' },
  { type: 'CLUB_ENTERED_TOP_25',     label: 'Club entered the Top 25',         category: 'RANKINGS', severity: 'SUCCESS', recipientScope: 'CLUB' },
  { type: 'CLUB_ENTERED_TOP_50',     label: 'Club entered the Top 50',         category: 'RANKINGS', severity: 'SUCCESS', recipientScope: 'CLUB' },
  { type: 'CLUB_ENTERED_TOP_100',    label: 'Club entered the Top 100',        category: 'RANKINGS', severity: 'SUCCESS', recipientScope: 'CLUB' },
  { type: 'CLUB_EXITED_TOP_100',     label: 'Club dropped out of the Top 100', category: 'RANKINGS', severity: 'WARNING', recipientScope: 'CLUB' },
  { type: 'CLUB_LEFT_TOP_100',       label: 'Club left the Top 100',           category: 'RANKINGS', severity: 'WARNING', recipientScope: 'CLUB' },
  { type: 'CLUB_NEW_NUMBER_ONE',     label: 'New national number one',         category: 'RANKINGS', severity: 'SUCCESS', recipientScope: 'PLATFORM' },
  // Fixtures and results
  { type: 'FIXTURE_PUBLISHED',       label: 'Fixture published',               category: 'FIXTURES', severity: 'INFO',    recipientScope: 'PLATFORM' },
  { type: 'RESULT_PUBLISHED',        label: 'Result published',                category: 'RESULTS',  severity: 'SUCCESS', recipientScope: 'PLATFORM' },
  { type: 'ROUND_FIXTURES_PUBLISHED',label: 'Round fixtures published',        category: 'FIXTURES', severity: 'INFO',    recipientScope: 'PLATFORM' },
  { type: 'ROUND_RESULTS_PUBLISHED', label: 'Round results published',         category: 'RESULTS',  severity: 'SUCCESS', recipientScope: 'PLATFORM' },
  // Leagues
  { type: 'LEAGUE_UPDATED',          label: 'League updated',                  category: 'LEAGUE',   severity: 'INFO',    recipientScope: 'LEAGUE' },
  { type: 'LEAGUE_STRENGTH_CHANGED', label: 'League strength changed',         category: 'RANKINGS', severity: 'INFO',    recipientScope: 'LEAGUE' },
  // Goal kickers and records
  { type: 'GOAL_KICKER_UPDATE',      label: 'Goal total updated',              category: 'GOAL_KICKERS', severity: 'INFO', recipientScope: 'PLATFORM' },
  { type: 'GOAL_KICKER_ACHIEVEMENT', label: 'Goal-kicker achievement',         category: 'GOAL_KICKERS', severity: 'SUCCESS', recipientScope: 'PLATFORM' },
  { type: 'RECORD_BROKEN',           label: 'Record broken',                   category: 'RECORDS', severity: 'SUCCESS', recipientScope: 'PLATFORM' },
  // Highlights and content
  { type: 'HIGHLIGHT_PUBLISHED',     label: 'Highlight published',             category: 'HIGHLIGHTS', severity: 'INFO', recipientScope: 'PLATFORM' },
  { type: 'HIGHLIGHT_WINNER',        label: 'Highlight winner selected',       category: 'HIGHLIGHTS', severity: 'SUCCESS', recipientScope: 'PLATFORM' },
  { type: 'ARTICLE_PUBLISHED',       label: 'Article published',               category: 'CONTENT',  severity: 'INFO', recipientScope: 'PLATFORM' },
  // Claims
  { type: 'CLAIM_SUBMITTED',         label: 'Claim submitted',                 category: 'CLAIMS', severity: 'INFO', recipientScope: 'ADMIN' },
  { type: 'CLAIM_APPROVED',          label: 'Claim approved',                  category: 'CLAIMS', severity: 'SUCCESS', recipientScope: 'USER' },
  { type: 'CLAIM_REJECTED',          label: 'Claim rejected',                  category: 'CLAIMS', severity: 'WARNING', recipientScope: 'USER' },
  // Commercial and championship
  { type: 'SPONSOR_EXPIRING',        label: 'Sponsor expiring soon',           category: 'COMMERCIAL', severity: 'WARNING', recipientScope: 'ADMIN' },
  { type: 'SPONSOR_EXPIRED',         label: 'Sponsor expired',                 category: 'COMMERCIAL', severity: 'WARNING', recipientScope: 'ADMIN' },
  { type: 'CHAMPIONSHIP_INVITATION', label: 'Championship invitation',         category: 'CHAMPIONSHIP', severity: 'SUCCESS', recipientScope: 'CLUB' },
  // Quality and system
  { type: 'DATA_QUALITY_ALERT',      label: 'Data quality issue',              category: 'QUALITY', severity: 'WARNING', recipientScope: 'ADMIN' },
  { type: 'REVIEW_REQUIRED',         label: 'Review required',                 category: 'QUALITY', severity: 'WARNING', recipientScope: 'ADMIN' },
  { type: 'FAILED_SYNC',             label: 'Failed sync',                     category: 'SYSTEM', severity: 'CRITICAL', recipientScope: 'ADMIN' },
  { type: 'SYNC_FAILED',             label: 'Sync failed',                     category: 'SYSTEM', severity: 'CRITICAL', recipientScope: 'ADMIN' },
]

export const CHANNELS = ['IN_APP', 'EMAIL', 'WEBHOOK', 'PUSH', 'SMS'] as const
export type Channel = typeof CHANNELS[number]
export const FUTURE_CHANNELS = new Set<string>(['PUSH', 'SMS'])
export const DIGEST_KINDS = ['DAILY_ADMIN', 'WEEKLY_RANKINGS', 'WEEKLY_CLUB', 'WEEKLY_LEAGUE'] as const
export type DigestKind = typeof DIGEST_KINDS[number]

export const TYPE_BY_KEY = new Map(NOTIFICATION_TYPES.map(t => [t.type, t]))
export const VALID_TYPES = new Set(NOTIFICATION_TYPES.map(t => t.type))
