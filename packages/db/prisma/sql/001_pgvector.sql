-- pgvector setup for Nexus.
--
-- Prisma has no native `vector` type, so the embedding column and its index are
-- managed here as raw SQL. Apply AFTER the Prisma schema migration:
--
--   pnpm --filter @nexus/db db:pgvector
--
-- (wired to `psql "$DATABASE_URL" -f prisma/sql/001_pgvector.sql`)

CREATE EXTENSION IF NOT EXISTS vector;

-- 1536 dims matches OpenAI text-embedding-3-small.
ALTER TABLE "Document"
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Approximate-nearest-neighbour index for cosine similarity search.
CREATE INDEX IF NOT EXISTS document_embedding_idx
  ON "Document"
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
