-- AlterTable: Add discountReason column to Folio if it does not already exist
-- This migration is safe to run on databases where the column was already
-- added outside of the migration system (e.g. via db push or manual ALTER).
ALTER TABLE "Folio" ADD COLUMN IF NOT EXISTS "discountReason" TEXT;
