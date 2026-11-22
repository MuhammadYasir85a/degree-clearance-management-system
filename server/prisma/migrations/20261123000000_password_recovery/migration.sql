ALTER TABLE "users"
ADD COLUMN "auth_version" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "password_reset_requests" (
    "reset_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "otp_hash" VARCHAR(64) NOT NULL,
    "otp_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "otp_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),
    "reset_token_hash" VARCHAR(64),
    "reset_expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "password_reset_requests_pkey" PRIMARY KEY ("reset_id")
);

CREATE UNIQUE INDEX "password_reset_requests_user_id_key"
ON "password_reset_requests"("user_id");

CREATE UNIQUE INDEX "password_reset_requests_reset_token_hash_key"
ON "password_reset_requests"("reset_token_hash");

CREATE INDEX "password_reset_requests_otp_expires_at_idx"
ON "password_reset_requests"("otp_expires_at");

ALTER TABLE "password_reset_requests"
ADD CONSTRAINT "password_reset_requests_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("user_id")
ON DELETE CASCADE ON UPDATE CASCADE;
