/**
 * Required production indexes (verified via Model.syncIndexes() at startup).
 *
 * Request
 *   - unique code
 *   - customerId + createdAt
 *   - providerId + status + createdAt
 *   - status + category + city + createdAt
 *   - watchToken + watchTokenExpiresAt
 *   - partial unique one_engaged_job_per_provider on engaged providerId
 *
 * WorkerLock
 *   - unique userId (one engaged job per worker)
 *   - jobId
 *
 * LedgerEntry
 *   - unique code
 *   - unique { requestId, type } as one_ledger_type_per_job
 *   - requestId, userId, type, status
 *
 * Cancellation
 *   - unique requestId
 *
 * User
 *   - unique { email, role }
 *   - unique sparse userCode
 *   - provider.category + available + status
 *
 * Session
 *   - unique tokenHash
 *   - TTL expiresAt
 *
 * Otp
 *   - email
 *   - TTL expiresAt
 */
export const REQUIRED_INDEXES = {
  Request: [
    "code_1",
    "customerId_1_createdAt_-1",
    "providerId_1_status_1_createdAt_-1",
    "one_engaged_job_per_provider",
    "watchToken_1_watchTokenExpiresAt_1",
  ],
  WorkerLock: ["userId_1", "jobId_1"],
  LedgerEntry: ["code_1", "one_ledger_type_per_job"],
  Cancellation: ["requestId_1"],
  User: ["email_1_role_1", "userCode_1"],
  Session: ["tokenHash_1", "expiresAt_1"],
  Otp: ["expiresAt_1"],
};
