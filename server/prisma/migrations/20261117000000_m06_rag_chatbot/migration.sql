-- Preserve the existing text embeddings while enabling database-side cosine search.
-- The service casts validated JSON vectors to vector(768) and filters by model.
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "knowledge_base"
  ADD COLUMN "embedding_model" VARCHAR(100),
  ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "chat_sessions"
  ADD COLUMN "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "chat_sessions" AS session
SET "updated_at" = COALESCE(
  (SELECT MAX(message."created_at")
   FROM "chat_messages" AS message
   WHERE message."session_id" = session."session_id"),
  session."started_at"
);

CREATE INDEX "chat_sessions_user_id_updated_at_session_id_idx"
  ON "chat_sessions"("user_id", "updated_at", "session_id");
CREATE INDEX "chat_messages_session_id_message_id_idx"
  ON "chat_messages"("session_id", "message_id");
CREATE INDEX "knowledge_base_is_active_embedding_model_idx"
  ON "knowledge_base"("is_active", "embedding_model");
