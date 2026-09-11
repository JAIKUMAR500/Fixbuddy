# FixBuddy Phased Requirements

**Document date:** 2026-09-10  
**Repository:** FixBuddy  
**Current baseline:** Core customer, business, worker, admin, chat, OTP, payment-collection, upload, and live-tracking flows exist. Frontend build, TypeScript validation, and backend syntax checks pass.

## Completed In This Workflow Pass

- Added global notification polling for logged-in users.
- Added unread notification counts to the application shell.
- Added visible in-app activity alerts, a short notification sound, and browser notifications when permission is already granted.
- Made worker acceptance open the accepted work-order tracking page immediately.
- Made customer/business worker selection open the request status/work-order page immediately.
- Kept lifecycle updates visible through the shared request timeline and live map polling.
- Clarified the acceptance notification so the request owner knows the worker accepted and is preparing to come.
- Login now requires the selected Customer, Worker, or Business account type for password and Google sign-in.
- Google Business sign-in supports both `business` and legacy `provider` records.
- Expired JWT sessions return a clear session-expired message instead of an invalid-credentials message.
- Login UI clearly labels the selected account type and password reset no longer displays OTPs.

## Worker Power System Added

- Added worker daily income target storage and progress API.
- Added nearby/recommended open-job API using the worker's saved location, category, distance, urgency, and estimated amount.
- Added worker professional passport storage and editable frontend screen.
- Added worker safety incident storage and emergency assistance action.
- Extended the existing team surface so worker accounts can own and manage a team without creating a duplicate team architecture.
- Added a worker dashboard panel for target progress, next-job suggestions, passport summary, and safety assistance.
- Improved Google sign-in rendering with `VITE_GOOGLE_CLIENT_ID` fallback and a responsive container.

At the start of this implementation pass, the following capabilities were not complete: verified online payments, atomic team-job assignment and team tracking, configurable cancellation compensation, skill/admin verification workflows, derived badges/QR public profiles, push/WebSocket notifications, and automated worker end-to-end tests.

## Remaining Features Implemented In This Pass

- Added transactional team-job creation, leader assignment, member authorization, and per-member location updates.
- Added configurable worker travel-compensation policy in Admin settings and applied the configured amount/time threshold to customer cancellations.
- Added derived professional badges and a public worker passport page suitable for QR links.
- Added worker skill verification requests plus an admin pending-skill approval/rejection queue.
- Added persisted notification preferences for job updates, email, and browser alerts.
- Added worker-power regression tests and root `test`, `test:backend`, and `typecheck` scripts.

Still required for a complete production rollout: MongoDB replica-set/Atlas transaction testing, payment-provider webhook verification, full team customer-selection UI, push/WebSocket delivery, comprehensive API integration tests, and Playwright mobile end-to-end tests.

## Delivery Rules

- Complete each phase in order.
- Do not release a phase until its acceptance criteria and validation tasks pass.
- Every backend state change must be authorized, validated, auditable, and safe to retry.
- Never expose passwords, tokens, OTP values, or unnecessary exact location data in logs or API responses.
- Add or update tests with every workflow change.
- Deploy only from the verified `main` commit and confirm the deployed frontend bundle is current.

## Phase 0: Deployment Baseline

**Goal:** Make the current code reliably deployable and observable before adding more functionality.

### Requirements

- Configure Vercel frontend root directory as `frontend`.
- Configure Render backend root directory as `backend`.
- Set frontend production variable:
  - `VITE_API_URL=https://<production-api>/api`
- Set backend production variables:
  - `MONGODB_URI`
  - strong `JWT_SECRET` with at least 32 characters
  - `ADMIN_PASSWORD`
  - `CLIENT_ORIGIN`
  - `API_PUBLIC_URL`
  - SMTP settings
- Add `/api/health` and `/api/ready` endpoints.
- `/api/ready` must verify database connectivity and report dependency status without exposing secrets.
- Add a deployment smoke check for frontend load, API health, login, and authenticated API access.
- Document separate local and production setup instructions.

### Acceptance Criteria

- Backend refuses to start in production with missing or default secrets.
- Frontend login requests reach the production API.
- Vercel serves the latest `main` build after redeployment.
- Health and readiness checks return useful status codes.

### Validation

- Run frontend typecheck and production build.
- Run backend syntax checks and startup validation.
- Test `/api/health` and `/api/ready` in the deployed environment.
- Complete one customer login smoke test.

## Phase 1: Security and Authentication

**Goal:** Protect accounts, reset flows, sessions, and privileged operations.

### Requirements

- Remove production fallback JWT secrets and default admin credentials.
- Rotate any secret previously used in deployment.
- Remove demo admin passwords from public production documentation.
- Never return or log password-reset OTP values in production.
- Return a generic forgot-password response for both existing and unknown email addresses.
- Add forgot-password rate limits by IP, email, and account.
- Add login rate limits and temporary account lockout after repeated failures.
- Add password-reset attempt limits and invalidate OTPs after successful use.
- Validate role authorization on every protected endpoint.
- Review admin routes for least-privilege access.
- Prefer secure, `HttpOnly`, `Secure`, `SameSite` cookies for sessions; if bearer tokens remain, add rotation and revocation.
- Add audit records for login failure, login success, password reset, role changes, and admin actions.

### Acceptance Criteria

- Weak production configuration fails startup.
- Password-reset OTP never appears in API responses or server logs in production.
- Unknown and existing email reset requests have indistinguishable responses.
- Repeated login/reset attempts are throttled.
- A non-admin cannot access admin APIs.
- Logout or revocation invalidates the session as designed.

### Validation

- Unit-test password hashing, JWT validation, role checks, reset OTP expiry, and lockout behavior.
- Integration-test login, logout, forgot password, reset password, and admin authorization.
- Run dependency and secret scanning in CI.

## Phase 2: Request Lifecycle and OTP Integrity

**Goal:** Make job state transitions correct, authorized, concurrency-safe, and understandable.

### Requirements

- Define and document the request state machine:
  - `matching -> open/requested -> accepted -> on_the_way -> arrived -> otp_verified -> in_progress -> completed -> payment_collected -> customer_completed -> reviewed`
- Enforce legal state transitions on the backend.
- Make worker acceptance atomic so only one worker can win a job.
- Prevent unauthorized workers from changing a request.
- Add job OTP expiry, failed-attempt count, lockout, and audit events.
- Keep OTP visible only to the customer at the arrived stage.
- Ensure a successful OTP verification can happen only once.
- Add cancellation rules for customer, business, worker, and admin roles.
- Add conflict responses when another worker changes a job first.
- Make all state-changing actions safe to retry.
- Add a timeline event for every significant state change.

### Acceptance Criteria

- Invalid transitions return clear errors and do not mutate data.
- Two workers accepting simultaneously results in exactly one accepted worker.
- Job OTP expires after its configured lifetime.
- Five invalid OTP attempts lock further attempts for the configured period.
- Correct OTP verification changes state exactly once.
- Customer and worker screens show the same current lifecycle state after refresh.

### Validation

- Unit-test every state transition.
- Add concurrent acceptance and concurrent OTP verification integration tests.
- Add frontend tests for customer OTP visibility and worker OTP entry.
- Add Playwright coverage for the customer/worker happy path.

## Phase 3: Payment and Financial Integrity

**Goal:** Replace self-attested payment collection with a trusted, auditable, idempotent payment workflow.

### Requirements

- Decide the payment model:
  - Online provider such as Razorpay/Stripe; or
  - Explicit offline/manual payment with customer confirmation.
- Store amount, currency, payer, payee, provider reference, status, timestamps, and receipt metadata.
- Do not credit a worker wallet from an unverified client-only declaration.
- Make payment collection idempotent.
- Use an atomic conditional update or MongoDB transaction.
- Add a unique index preventing more than one successful payment for a request.
- Replace count-based transaction codes with collision-resistant IDs.
- Handle provider webhook verification if online payments are used.
- Add refund, cancellation, failed-payment, and dispute states.
- Add customer receipt and worker earnings history.
- Add admin reconciliation tools for mismatched payments and wallet balances.

### Acceptance Criteria

- A payment cannot be collected twice, even with repeated or concurrent requests.
- A worker wallet is credited once and only after the payment is valid.
- Every payment has a unique immutable reference.
- Failed and refunded payments do not appear as successful earnings.
- Customer and worker see consistent payment status after refresh.

### Validation

- Unit-test amount and status rules.
- Integration-test duplicate requests and concurrent collection.
- Test webhook signature verification if a provider is integrated.
- Test refunds and failed payments.
- Reconcile sample request totals against transaction totals.

## Phase 4: Uploads, Location, and Privacy

**Goal:** Protect user content, customer addresses, and live location data.

### Requirements

- Validate upload size, extension, MIME type, and file signature.
- Sanitize or rasterize SVG files before public delivery.
- Add per-user upload rate limits and storage quotas.
- Move production uploads to controlled object storage.
- Add file deletion, retention, orphan cleanup, and moderation behavior.
- Allowlist remote media hosts or download and validate remote media server-side.
- Validate latitude and longitude bounds.
- Reject impossible location jumps and stale timestamps.
- Show approximate location before worker assignment.
- Reveal exact service location only to the customer and assigned worker.
- Reveal worker location only to the customer and assigned job participants.
- Delete or anonymize old tracking data after a defined retention period.
- Add location permission, privacy, and tracking-status messaging in the UI.

### Acceptance Criteria

- Invalid uploads are rejected before storage.
- SVG uploads cannot execute active scripts when viewed.
- Upload abuse cannot exhaust server disk.
- Unassigned workers cannot see exact customer coordinates.
- Invalid or impossible coordinates are rejected.
- Tracking stops when the job ends or is cancelled.

### Validation

- Test malicious file types, oversized uploads, SVG payloads, and remote URLs.
- Test role-based location visibility.
- Test invalid coordinates and impossible movement.
- Test tracking cleanup and retention jobs.

## Phase 5: Frontend Product Quality

**Goal:** Make the web app reliable, responsive, accessible, and easy to operate.

### Requirements

- Add URL-based routing with refresh restoration and browser back/forward support.
- Preserve role guards on every protected route.
- Add loading, empty, offline, retry, and permission-denied states.
- Show clear customer guidance for where the 4-digit job OTP appears.
- Add confirmation steps for destructive actions and payment actions.
- Ensure mobile layouts work for customer, worker, business, and admin screens.
- Add keyboard navigation, visible focus, semantic labels, accessible errors, and sufficient contrast.
- Fix map refresh cleanup and coordinate checks.
- Add error boundaries and a user-safe fallback screen.
- Add notification refresh behavior and unread-state consistency.
- Add form validation before API requests.
- Avoid exposing sensitive data in browser storage where possible.

### Acceptance Criteria

- Refreshing any supported page preserves the intended route or redirects safely.
- Browser back/forward works for primary workflows.
- Every API-driven screen has loading/error/empty states.
- Customer and worker flows work at mobile and desktop widths.
- Primary workflows are keyboard-accessible.
- No uncaught React error leaves the app blank.

### Validation

- Run frontend typecheck and production build.
- Run component tests for auth, request status, OTP, payment, and tracking.
- Run Playwright tests on desktop and mobile viewports.
- Perform accessibility checks on login, request creation, tracking, and admin screens.

## Phase 6: Testing and CI/CD

**Goal:** Prevent regressions before code reaches production.

### Requirements

- Add backend unit and integration testing framework.
- Add frontend component testing framework.
- Add Playwright end-to-end smoke tests.
- Add a test database strategy and seeded test accounts.
- Add CI checks for:
  - formatting/linting
  - frontend typecheck
  - frontend production build
  - backend syntax/tests
  - dependency audit
  - secret scanning
- Require all checks to pass before merging to `main`.
- Add deployment preview testing for frontend changes.
- Add rollback instructions for frontend and backend deployments.

### Minimum End-to-End Scenarios

1. Customer signup/login and profile completion.
2. Customer creates a request with images and location.
3. Worker sees and accepts an available request.
4. Worker moves through on-the-way and arrived states.
5. Customer sees and shares the 4-digit OTP.
6. Worker verifies OTP and starts work.
7. Worker completes the job.
8. Customer confirms payment or completes provider payment.
9. Worker sees one payment and one wallet credit.
10. Customer submits a review.
11. Invalid roles cannot access protected actions.

### Acceptance Criteria

- CI catches type, syntax, build, and core workflow regressions.
- Main customer/worker workflow passes in a clean environment.
- Duplicate payment and OTP abuse tests pass.
- Deployment can be rolled back using documented steps.

## Phase 7: Operations and Scale

**Goal:** Prepare the service for real users and sustained operation.

### Requirements

- Add structured logs with request IDs.
- Redact tokens, passwords, OTPs, and sensitive location data from logs.
- Add error monitoring and alerting.
- Track API latency, error rate, database health, mail failures, upload failures, and payment mismatches.
- Add MongoDB backups and restore verification.
- Add database indexes based on production query metrics.
- Add cron job locking so multiple backend instances do not duplicate work.
- Add storage lifecycle management.
- Add admin audit search and export.
- Add privacy policy, terms, payment policy, cancellation policy, and support process.
- Add rate limiting and abuse detection at the edge/API gateway.

### Acceptance Criteria

- Critical failures generate alerts with actionable context.
- Backups can be restored in a test environment.
- Cron tasks run once per interval across multiple backend instances.
- Admin actions are traceable.
- Privacy, payment, and cancellation policies are visible to users.

## Recommended Build Order

| Order | Phase | Release decision |
|---:|---|---|
| 1 | Phase 0: Deployment Baseline | Required before production testing |
| 2 | Phase 1: Security and Authentication | Required before real user accounts |
| 3 | Phase 2: Request Lifecycle and OTP | Required before real service jobs |
| 4 | Phase 3: Payment and Financial Integrity | Required before charging or wallet payouts |
| 5 | Phase 4: Uploads, Location, and Privacy | Required before broad public launch |
| 6 | Phase 5: Frontend Product Quality | Required before polished release |
| 7 | Phase 6: Testing and CI/CD | Required before frequent team development |
| 8 | Phase 7: Operations and Scale | Required for production growth |

## Immediate Next Tickets

1. Add production environment validation and rotate deployed secrets.
2. Add generic password-reset responses and remove OTP disclosure/logging.
3. Add request OTP attempt limits and expiry tests.
4. Implement idempotent payment confirmation with a unique request payment record.
5. Add upload validation and quotas.
6. Restrict exact location visibility by request participant.
7. Add backend request-state integration tests.
8. Add customer/worker Playwright smoke test.
9. Configure Vercel and Render deployment smoke checks.
10. Commit and deploy each completed phase separately.

## Definition Of Done For A Phase

A phase is complete only when:

- Requirements are implemented in source code.
- Database changes and environment variables are documented.
- Automated tests cover the changed behavior.
- Frontend build and backend validation pass.
- Security and authorization behavior is verified.
- Mobile and desktop behavior is checked where relevant.
- Deployment smoke testing passes.
- Documentation and rollback notes are updated.
