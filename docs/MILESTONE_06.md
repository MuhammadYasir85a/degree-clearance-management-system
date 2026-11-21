# Milestone 06: Groq + Hugging Face RAG chatbot

The backend retrieves relevant university guidance with pgvector cosine similarity, combines it with the authenticated student's current clearance and degree status, and asks Groq for a grounded answer. Conversations are stored in `ChatSession` and `ChatMessage`. Admins manage and embed knowledge articles; controllers can read the article management list.

## Provider configuration

This implementation replaces the previous Gemini integration with `groq-sdk` and Hugging Face's hosted feature-extraction API:

- `GROQ_API_KEY`: server-side Groq credential.
- `HF_TOKEN`: Hugging Face token with Inference Providers permission and available credits.
- `GROQ_MODEL=llama-3.1-8b-instant`: requested default; override with a model enabled for your account.
- Embedding model: `sentence-transformers/all-MiniLM-L6-v2`, **384 dimensions**.
- HF route: `https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction`.

The legacy `api-inference.huggingface.co` address from the supplied template is replaced with the current router path. See [Hugging Face feature extraction](https://huggingface.co/docs/inference-providers/tasks/feature-extraction), [HF's routing implementation](https://github.com/huggingface/huggingface.js/blob/main/packages/inference/src/providers/hf-inference.ts), and [Groq text generation](https://console.groq.com/docs/text-chat).

No model weights or local inference runtime are loaded on the application server. Node still uses memory and CPU for requests, JSON parsing, and small vector operations; this is not a guarantee of zero resource use or Azure capacity. Hosting quotas and provider credits apply independently.

HF calls use bounded 10-second timeouts and up to three attempts only for transient failures. Authentication, billing, model errors, and invalid vectors fail immediately with sanitized errors. The service validates sentence-vector shapes and finite nonzero values, then normalizes them. Articles are split into chunks of at most 512 characters, embedded as a remote batch, and their normalized vectors averaged. This reduces MiniLM truncation of long articles without downloading a tokenizer or model. Chunk boundaries are character based, not an exact token guarantee; HF truncation remains enabled.

Articles store `embedding_model`. Old Gemini vectors are excluded from 384-dimensional queries before casting, even while re-embedding is incomplete. Run the seeder to replace seed article vectors; for other articles, update their content or set `is_active: true` through the admin API to rebuild mismatched vectors. Disabled seed articles stay disabled. No vector-column type migration is required: the existing `embedding` column remains text.

## Two guardrail layers

The local filter uses normalized whole words, explicit off-topic/jailbreak patterns, and context-aware follow-ups. Obvious irrelevant requests return a fixed scope reminder before any HF/Groq call. Ambiguous questions use embedding similarity; without a qualifying article, they are rejected before Groq generation. These latter checks consume an HF inference request, but zero Groq generation tokens. Short follow-ups such as "What next?" can use the latest related user question.

The second layer is a strict university-only system instruction. It treats retrieved articles, officer remarks, and conversation history as untrusted data, requires grounding and source references, refuses unrelated requests even with university keyword padding, and forbids fabricated policies or record mutations. Heuristics and prompts reduce misuse; they are not a guarantee against every possible jailbreak. Retrieval failures return service errors rather than permitting ungrounded generation.

Refusals return `sources: []` and `guardrail: { blocked: true, reason: ... }`; they can be saved as normal conversation turns. Provider failures do not save partial turns.

## Configuration and database setup

Run these commands from `server/`:

```bash
npm install
npx prisma validate
npx prisma migrate status
```

Use `server/.env.example` as the configuration reference. Preserve the existing database and JWT settings in `server/.env`; add the Groq/Hugging Face settings and enter the actual keys locally. Do not paste API keys into source files, chat messages, or the Postman collection.

The registration-schema reconciliation migration fills the gap between the original 12-table migration and the current 15-table schema. It creates missing program/registration tables, indexes, and foreign keys while preserving existing equivalent structures and records. The following M06 migration enables the PostgreSQL `vector` extension and adds KnowledgeBase activation/model/timestamp fields and session timestamps/indexes. Together, the migrations also support a fresh database. For an existing Milestones 01–05 database with a consistent migration history:

```bash
npx prisma migrate deploy
npx prisma generate
```

Inspect any reported migration drift or incompatible baseline structures before deployment. The reconciliation migration deliberately fails on incompatible structures rather than silently changing or dropping existing data. Do not reset an existing database to resolve drift or mark migrations applied without confirming schema equivalence. Neither new migration erases application records. Both migrations were applied to the configured Neon database during the approved live verification on November 20, 2026.

After the database is ready:

```bash
npm run seed:kb
npm test
npm run dev
```

The seed script loads `server/.env` explicitly, generates document embeddings, and creates or updates its own articles. Embedding failures cause an unsuccessful run; a success message means the corresponding embedding and database write completed. The seed content covers implemented workflow behavior and directs users to the responsible office for current fees, hours, and contact details. It does not turn the example prices, office locations, or phone extensions in the original proposal into verified university policy.

## Retrieval and grounding

1. Validate and bound the question and conversation history.
2. Generate a 384-dimensional query embedding using the configured embedding model.
3. Search active KnowledgeBase articles with the matching embedding model using PostgreSQL's pgvector cosine-distance operator. Embeddings remain JSON text in the existing `embedding` field and are cast to `vector(384)` by the parameterized SQL query.
4. For a student, read only that authenticated user's current clearance reviews, degree application, document verification results, and receipt collection date. Other roles receive institutional guidance without another student's private status.
5. Supply retrieved guidance, bounded history, and live status as context to Groq. Context and user content do not override the assistant's grounding instructions.
6. Persist the completed user/assistant exchange and return the answer with retrieved sources.

`sources[].similarity` is a raw cosine similarity score in `[-1, 1]`, not a calibrated probability that an answer is correct. A compatibility `confidence` percentage, when returned, also reflects retrieval similarity. Sources identify retrieved articles; a client should not treat every retrieved article as an independently verified claim.

The chatbot does not approve clearance, verify documents, change degree status, or collect fees. Those actions continue through the existing authorized workflow APIs. Live context and conversation text sent to Groq may include student status and recorded officer remarks; configure provider access and retention for the deployment accordingly.

## API

All paths below are relative to `/api/chat`. Use `Authorization: Bearer <token>` or the existing authenticated cookie.

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/message` | Student, officer, controller, admin | Send `{ "message": "...", "session_id": 123 }`; omit `session_id` for a new conversation |
| GET | `/sessions` | Authenticated owner | List own conversations |
| GET | `/sessions/:session_id` | Authenticated owner | Read a conversation and its messages |
| DELETE | `/sessions/:session_id` | Authenticated owner | Delete a conversation and its messages |
| POST | `/admin/kb` | Admin | Create an article and its embedding |
| GET | `/admin/kb` | Admin, controller | List articles without embedding payloads |
| PUT | `/admin/kb/:kb_id` | Admin | Edit an article, regenerate changed content embeddings, or set `is_active` |
| DELETE | `/admin/kb/:kb_id` | Admin | Delete an article |

Article creation requires nonempty `title`, `category`, and `content`. Title is limited to 200 characters, category to 50, and content to 6,000. `source_document` may identify the source. Disable an article with `{ "is_active": false }` to exclude it from retrieval while preserving the record.

Re-embedding is completed before replacing article content, so a failed embedding call does not leave new content paired with an old vector. A caller cannot select another user's live profile through the request body. Invalid session identifiers return `400`; missing or another user's sessions return `404` rather than silently creating a new conversation.

Session lists, message history, and article lists accept `page` and `limit` parameters; the default page size is 20 and the maximum is 100. Session and article updates use optimistic concurrency checks: if a record changes while an answer or embedding is being generated, `409` asks the caller to reload and retry.

Chat messages are limited to 10 attempts per authenticated user per minute. Excess requests return `429`, `code: "CHAT_RATE_LIMITED"`, and a `Retry-After` header in seconds. The in-memory limiter prunes expired entries, tracks at most 10,000 active users, and returns `503` if that capacity is full. These limits apply within one API process; use an equivalent shared-store limiter or gateway policy for deployments with multiple API instances.

Missing provider configuration and provider availability errors return an error response, including `503` when either required provider key is absent. They do not create a successful-looking assistant exchange. Authentication and role denials retain `401` and `403` responses.

## Postman verification

Import [`UET-M06-AI-RAG.postman_collection.json`](../postman/milestone-06/UET-M06-AI-RAG.postman_collection.json). The collection has 30 ordered requests covering authentication, general and personal questions, history, ownership, role restrictions, KB creation/update/deactivation/deletion, validation, and cleanup.

Set `base_url` to the API root, for example `http://localhost:5000/api`. Do not add another `/api` suffix to the requests. The included login bodies use local development seed accounts; update them for your test database. Tokens and generated IDs use collection-scoped `m06_*` variables, so they do not replace the existing Postman global tokens. Clear any environment variables with those names that would override collection values.

Run requests in order. Successful RAG requests require all of the following:

- A running API and reachable database.
- Applied M06 migration and regenerated Prisma Client.
- Valid Groq/Hugging Face credentials, account-enabled models, and inference credits/quota.
- Successfully seeded or manually embedded knowledge articles.
- The local student, admin, and controller test accounts.

The collection creates one temporary article and one student conversation and removes both near the end. If a run stops early, use the saved `m06_kb_id` and `m06_chat_session_id` to run the matching cleanup requests. A missing API key, failed seeder, or unavailable model is a failed live prerequisite; it must not be reported as a passed RAG test.

Compare personalized answers with `/api/clearance/my-status` and `/api/degree/my-application`, including department and document remarks. Read answers to fee or timing questions to ensure the assistant asks the responsible office when no verified policy article supplies the value. Automated response-shape assertions do not establish factual accuracy.

## Verification boundary

Run the tests with Node.js 22.3 or later; they use Node's experimental module-mocking flag. `npm test` verifies backend behavior without needing production credentials. Its development-only PGlite and pgvector dependencies run real PostgreSQL migrations and cosine-search SQL in memory; they do not connect to Neon.

**53 local tests passed**, and Prisma validation passed. Tests cover provider request/response handling, retries, domain filtering and jailbreak refusals, RAG grounding, ownership and role permissions, atomic message persistence, concurrent updates, KB embedding consistency, rate limiting, seeder behavior, and real migration/search SQL in isolated PGlite. Run `npm test` for the current result.

Live verification on November 20, 2026:

- Set `GROQ_MODEL=llama-3.1-8b-instant` in the local environment and the service default, as explicitly requested. Credentials used by the process were confirmed to match the local `.env` values without printing them.
- Applied `20261116000000_registration_schema_sync` and `20261117000000_m06_rag_chatbot` successfully to Neon and regenerated Prisma Client. Existing application records were preserved.
- Backend health returned 200; unauthenticated chat returned 401. Development student login, an off-topic response without provider calls, atomic persistence of the user/assistant pair, own session list/history, student KB access denial (403), and deletion of the temporary test conversation all passed against the live database.
- Hugging Face returned HTTP **402** and reported credits/billing when called with the supplied token, including a fresh retry after user approval. The provider did not return an embedding.
- Groq returned HTTP **404**, `model_not_found`, for `llama-3.1-8b-instant` with the configured API key. Successful authentication does not imply access to this model.
- The user explicitly approved transfer of seed guidelines and active department names to HF. The subsequent seeder execution was allowed and ran, but stopped on its first embedding request with `HF_PAYMENT_REQUIRED`. Since embedding all articles precedes the write transaction, it wrote no articles and preserved existing KB content.

All M06 Prisma operations, including raw retrieval SQL, transactions, transaction-client calls, and disconnect, remain wrapped in `withDbRetry`.

Successful 384-dimensional seeding and full live Postman RAG verification remain pending provider access. Once HF inference succeeds and the Groq key can access the requested model, run `npm run seed:kb` and the Postman collection. No additional seed-transfer approval is needed for the scope already approved. HTTP 402/404 responses cannot supply the vectors or answers required for successful RAG.
