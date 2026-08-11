export type ClubAccount = {
  clubId: string
  clubName: string
  logoUrl?: string | null
  role: string
  permissions?: string[]
  defaultPage?: string
}

export type AuthSession = {
  access_token: string
  refresh_token: string
  expires_at?: number
  expires_in?: number
  user?: { id?: string; email?: string | null }
  club_accounts?: ClubAccount[]
}

export type AppArea =
  | 'overview'
  | 'coaching'
  | 'studio'
  | 'memberships'
  | 'website'
  | 'operations'
  | 'analytics'
  | 'sponsors'
  | 'settings'
