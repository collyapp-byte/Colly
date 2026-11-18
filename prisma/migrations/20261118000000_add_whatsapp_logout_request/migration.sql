-- Owner-requested WhatsApp logout.
--
-- The dashboard's Disconnect button writes this column; the standalone worker
-- polls for it, calls Baileys' `logout()` on the live socket and clears the
-- flag. A timestamp (rather than inferring from `status`) keeps a transient
-- reconnect — which also leaves the row DISCONNECTED for a few seconds — from
-- being mistaken for a logout and wiping healthy credentials.
--
-- Re-runnable like every migration here: `npm run build` applies this on every
-- release, including to a database that was patched by hand.

ALTER TABLE "WhatsAppSession"
  ADD COLUMN IF NOT EXISTS "logoutRequestedAt" TIMESTAMP(3);
