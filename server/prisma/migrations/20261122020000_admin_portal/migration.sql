ALTER TABLE "activity_logs"
ADD COLUMN "ip_address" VARCHAR(64),
ADD COLUMN "details" JSONB;
