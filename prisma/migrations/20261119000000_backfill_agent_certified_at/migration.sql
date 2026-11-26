DO $$
BEGIN
  UPDATE "Agent" SET "certifiedAt" = NOW() WHERE "certifiedAt" IS NULL AND EXISTS (
    SELECT 1 FROM "AgentCertificate" WHERE "AgentCertificate"."agentId" = "Agent"."id"
  );
END$$;