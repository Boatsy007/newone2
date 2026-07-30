-- Optional public club cover photo. Nullable so every existing club keeps the current hero design.
ALTER TABLE "club_profiles" ADD COLUMN IF NOT EXISTS "coverPhotoUrl" TEXT;
