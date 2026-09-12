# FixBuddy Project Review

**Review date:** 2026-09-10  
**Scope:** Frontend, backend, authentication, request lifecycle, OTP, payment collection, live tracking, uploads, configuration, and deployment  
**Current repository revision:** `7816994` (`main` and `origin/main` synchronized)

## Executive Summary

FixBuddy is a React 19 + Vite frontend backed by an Express + MongoDB API. The primary workflows are present: customer requests, provider/worker matching, chat, notifications, OTP-based work start, manual payment confirmation, reviews, admin settings, uploads, and live location tracking.

The project currently builds successfully, and all backend JavaScript files pass syntax validation. The most important problems are production safety and workflow integrity rather than compilation failures:

1. Production startup can silently use known JWT and admin-password defaults.
2. Password-reset OTP can be returned to the browser and logged when email delivery is unavailable.
3. The four-digit job OTP has no failed-attempt limit or expiry enforcement.
4. Payment collection is a manual worker declaration, not a verified payment, and is vulnerable to duplicate wallet credits under concurrent requests.
5. Upload and location handling needs stronger validation and privacy controls.
6. The frontend map can accumulate stale markers during polling.
7. There are no automated unit, integration, or end-to-end tests.
8. Deployment configuration must be kept synchronized: GitHub can be current while the hosted frontend still serves an older bundle.

## Validation Performed

| Check | Result | Notes |
|---|---|---|
| `npm run build` | Passed | Vite production build succeeds. Vite reports a `__dirname` future-compatibility warning and a bundle-size warning. |
| Frontend `npx tsc --noEmit` from `frontend/` | Passed | No TypeScript errors reported. |
| `node --check` for every `backend/src/**/*.js` file | Passed | No backend syntax errors. |
| Automated test discovery | No tests found | No Jest, Vitest, Playwright, Cypress, or test/spec files were found. |
| Git status before this report | Clean | `main` was synchronized with `origin/main` at `7816994`; this review file is the only new untracked artifact. |
| Backend health | Previously verified reachable | Render `/api/health` returned `{ "ok": true, "service": "fixbuddy-api" }`. |
| Hosted frontend freshness | Previously identified issue | Vercel was serving an older JavaScript bundle that did not contain the latest map, OTP, payment, and live-tracking markers. |

## Improvements Implemented During This Review

- Production startup now rejects the known JWT fallback and the default admin password.
- Password-reset OTPs are no longer returned to the browser or logged when mail delivery fails in production.
- Job OTPs now expire after 15 minutes and lock after five failed attempts for 10 minutes.
- Live map refreshes clear the complete marker/polyline layer group, including circle markers.
- Map visibility checks now accept valid zero-valued coordinates.
- Login now enforces the selected Customer, Worker, or Business role for password and Google sign-in.
- Google Business sign-in recognizes both `business` and legacy `provider` accounts.
- Expired sessions now return a clear session-expired message instead of being reported as invalid credentials.
- Password-reset UI no longer displays OTP values in the browser.
- Added additive worker APIs for daily targets, recommended jobs, earnings history, safety incidents, and professional passports.
- Added worker dashboard panels for target progress, next-job recommendations, passport summary, and safety assistance.
- Extended the existing team route for worker-owned teams and added worker passport navigation.
- Improved Google sign-in rendering with a frontend client-ID fallback and responsive container.
- Added transactional team-job creation, member assignment/location tracking, and authorization.
- Added configurable cancellation compensation with an admin-managed amount and travel-duration threshold.
- Added derived passport badges, public worker passport pages, QR links, and admin skill verification.
- Added persisted notification preferences and a backend worker-power regression test script.

Payment idempotency, upload hardening, location privacy, URL routing, and automated tests remain follow-up work described below.

## Findings By Priority

### P0: Block production release

#### 1. Known production fallback secrets and credentials

**Evidence:** The previous configuration used predictable fallback secrets and publicly documented admin credentials.

**Risk:** If production environment variables are missing, attackers can predict the admin password and forge JWTs. This can expose every authenticated route and administrative settings.

**Required fix:**

- Fail backend startup in production when `JWT_SECRET` is missing or weak.
- Fail startup when `ADMIN_PASSWORD` remains the default.
- Remove real-looking production credentials from public documentation.
- Rotate any secret that has been used in a deployed environment.
- Add a deployment preflight check that validates `MONGODB_URI`, `JWT_SECRET`, `CLIENT_ORIGIN`, and admin credentials.

#### 2. Password-reset OTP is exposed when SMTP is not configured

**Evidence:** `backend/src/routes/auth.js:199-240` generates the OTP, queues/sends mail, and can return the OTP when delivery fails. The frontend then displays/autofills the code in `frontend/src/pages/Auth.tsx`.

**Risk:** A password reset becomes possible through an API response, browser session, or server log. This defeats the purpose of email verification.

**Required fix:**

- Never return a reset OTP outside an explicit local-development mode.
- Never log the OTP.
- In production, reject reset requests with a generic delivery error if SMTP is not healthy.
- Always return the same generic response for existing and unknown email addresses.
- Add IP, account, and device rate limits.
- Add audit events for reset requests, successful resets, failed OTPs, and lockouts.

### P1: High-risk functional and security bugs

#### 3. Four-digit job OTP has unlimited guesses

**Evidence:** `backend/src/routes/requests.js:420-435` verifies the submitted code but has no failed-attempt counter, lockout, or endpoint rate limit. The job OTP is generated when the worker arrives.

**Risk:** The assigned worker can repeatedly guess a 4-digit value. The OTP does not provide a meaningful presence check without throttling and expiry.

**Required fix:**

- Add `otpAttempts`, `otpLockedUntil`, and `otpExpiresAt` fields.
- Limit attempts per request and per worker.
- Expire the OTP after a short period or when the job is cancelled.
- Audit failed and successful verification attempts.
- Use a transaction/conditional update so two verification requests cannot both succeed.

#### 4. Payment collection is not actual payment processing

**Evidence:** `backend/src/routes/requests.js:503-530` lets the worker call `collect-payment`, marks the request collected, creates a transaction, and updates the wallet. No payment provider, customer confirmation, receipt, payment intent, or external transaction ID is required.

**Risk:** A worker can claim payment was received and create platform revenue/wallet credit without money moving. Customers have no reliable dispute or payment record.

**Required fix:** Choose and implement one explicit model:

- Integrate Razorpay/Stripe/another provider with server-side webhook verification; or
- Clearly label this as an offline/manual payment workflow and require customer confirmation before crediting the worker.

For either model, store provider ID, amount, currency, payer, payee, status, timestamps, and receipt metadata.

#### 5. Payment collection is vulnerable to duplicate credits

**Evidence:** The current flow checks `paymentStatus`, saves the request, creates a transaction, and updates the worker balance as separate operations. Transaction identifiers are generated using a count-based approach.

**Risk:** Concurrent requests, retries, or double clicks can create duplicate transactions and wallet credits, even though the UI attempts to disable the action.

**Required fix:**

- Use a MongoDB transaction or an atomic conditional update on the request.
- Add a unique database index on the payment transaction's request ID and transaction type.
- Use an idempotency key for collection requests.
- Update wallet balance atomically and make reconciliation possible.
- Add a unique provider/payment reference rather than using document counts.

#### 6. Upload validation and storage controls are insufficient

**Evidence:** `backend/src/routes/upload.js` accepts data URLs/remote URLs and writes uploaded content under a public static directory configured in `backend/src/index.js`. File type is largely derived from the submitted MIME/name, and there is no visible per-user storage quota or upload rate limit.

**Risk:** Users may upload active SVG content, oversized files, unexpected binary content, or enough files to exhaust server storage. Public hosting also makes moderation and deletion harder.

**Required fix:**

- Validate size, extension, MIME, and magic bytes server-side.
- Sanitize or rasterize SVG before serving it.
- Set restrictive content headers and a content-security policy for uploads.
- Add per-user request-rate and total-storage limits.
- Use object storage for production and store metadata in MongoDB.
- Add deletion, retention, moderation, and orphan-file cleanup jobs.

#### 7. Remote image URLs are accepted without an allowlist

**Evidence:** `backend/src/routes/upload.js` accepts `http`/`https` URLs and stores them as-is.

**Risk:** Profiles and requests can reference tracking pixels, phishing content, unstable media, or unexpected remote resources. The application cannot guarantee availability or safety of the content.

**Required fix:** Allowlist trusted hosts, or download and validate remote media on the backend before storing it. Reject non-image content and unsafe URL schemes.

### P2: Important privacy, reliability, and usability issues

#### 8. Exact location data is exposed too broadly

**Evidence:** Request serialization in `backend/src/utils/serialize.js` includes service and worker coordinates based on request context. Matching/invited workers can see request data before the job is fully assigned.

**Risk:** Exact customer location can be disclosed to multiple workers, creating privacy and personal-safety concerns.

**Required fix:**

- Show an approximate area before acceptance.
- Reveal exact service coordinates only to the customer and assigned worker.
- Restrict worker coordinates to the customer and assigned job participants.
- Delete or anonymize historical location points after a retention period.
- Add a clear location-consent explanation in the UI.

#### 9. Worker location is client-controlled and not validated enough

**Evidence:** The worker location endpoint accepts latitude/longitude supplied by the browser and writes them to the request/profile.

**Risk:** A client can submit impossible coordinates or spoof being near the customer. This affects ETA, matching, and trust in live tracking.

**Required fix:** Validate latitude `[-90,90]`, longitude `[-180,180]`, timestamp freshness, and maximum movement between updates. Treat client coordinates as untrusted evidence, not proof of presence.

#### 10. Live map leaves stale circle markers during refresh

**Evidence:** `frontend/src/components/TrackMap.tsx:53-72` removes `L.Marker` and `L.Polyline`, but renders `L.circleMarker()`. `frontend/src/pages/customer/RequestStatus.tsx:45` reloads the request every eight seconds.

**Risk:** Old worker/customer markers can remain after location changes, producing a confusing map and unnecessary layer growth.

**Required fix:** Put all markers and lines in a dedicated Leaflet layer group and clear the group before rendering the latest points. Destroy the map instance on component unmount when appropriate.

#### 11. Coordinate truthiness checks reject valid zero coordinates

**Evidence:** `frontend/src/components/TrackMap.tsx:83` and related UI checks use `!lat`. Latitude/longitude value `0` is valid but treated as missing.

**Required fix:** Check `lat != null && lng != null` rather than truthiness.

#### 12. Frontend navigation is not URL-based

**Evidence:** `frontend/src/api/AppContext.tsx` stores the current view in React state and does not provide normal URL/history routing.

**Impact:** Refreshing loses the current page, deep links cannot be shared, and browser back/forward behavior is limited.

**Required fix:** Add React Router or synchronize view state with `history.pushState`, including authenticated route guards and refresh restoration.

#### 13. Authentication token is stored in localStorage

**Evidence:** `frontend/src/api/AppContext.tsx` stores `fb_token` in `localStorage`.

**Risk:** Any successful XSS can read the bearer token and impersonate the user until expiry.

**Required fix:** Prefer a secure, `HttpOnly`, `Secure`, `SameSite` cookie session. If localStorage is retained temporarily, add a strict CSP, sanitize all user-controlled content, shorten token lifetime, and implement token rotation/revocation.

#### 14. No automated regression coverage

**Evidence:** No test/spec files were found, and package scripts only provide development/build/start/seed commands.

**Risk:** Login role behavior, request state transitions, OTP visibility, payment idempotency, CORS, and responsive layouts can regress unnoticed.

**Required fix:** Add tests in this order:

1. Backend unit tests for OTP, serialization, roles, payment state, and auth.
2. API integration tests against a test MongoDB database.
3. Frontend component tests for login, customer tracking, worker OTP, and payment confirmation.
4. Playwright smoke tests for customer and worker happy paths on desktop and mobile.
5. CI checks for typecheck, build, syntax, tests, and dependency auditing.

## Functional Improvements

### Customer experience

- Add a clear request status state machine: `requested -> accepted -> on_the_way -> arrived -> otp_verified -> in_progress -> completed -> payment -> reviewed`.
- Show the customer exactly where the OTP appears, including a visible “Share this code with your worker” state.
- Add cancellation rules, refund/dispute flow, and clear responsibilities at each status.
- Add empty, loading, offline, retry, and permission-denied states for every data-driven screen.
- Preserve request state after refresh with URL routes and server reload.
- Improve accessibility: keyboard focus, labels, error announcements, contrast, and non-color status indicators.

### Worker/business experience

- Separate business owner and worker permissions more explicitly.
- Prevent accepting jobs that have already been assigned using atomic server-side transitions.
- Add job conflict messages and refresh/retry behavior when another worker wins a request.
- Show payment status with a verified receipt rather than only a button.
- Add earnings reconciliation and transaction history with immutable references.

### Admin and operations

- Add health/readiness checks for MongoDB, SMTP, storage, and external providers.
- Add structured logs with request IDs; do not log passwords, tokens, OTPs, or sensitive coordinates.
- Add audit views for auth changes, role changes, payment actions, OTP actions, and admin settings.
- Add monitoring and alerts for error rate, mail failures, upload failures, payment mismatch, and cron failures.
- Add database backup, migration, retention, and restore procedures.

## Deployment Checklist

### Vercel frontend

- Repository: `JAIKUMAR500/Fixbuddy`
- Production branch: `main`
- Root directory: `frontend`
- Production variable: `VITE_API_URL=https://fixbuddy-1-nh5a.onrender.com/api`
- Redeploy after every relevant commit; use “redeploy without cache” when a stale bundle is suspected.
- Test with an incognito window and verify the deployed asset contains the latest feature code.

### Render/backend

- Root directory: `backend`
- Start command: `npm start`
- Required variables: `MONGODB_URI`, strong `JWT_SECRET`, `CLIENT_ORIGIN`, `API_PUBLIC_URL`, `ADMIN_PASSWORD`, and SMTP settings.
- Restrict `CLIENT_ORIGIN` to the actual production frontend domains.
- Configure persistent/object storage for uploads.
- Confirm cron behavior after restarts and verify that only one scheduled worker runs.

## Recommended Delivery Plan

### Sprint 1: Security and data integrity

- Remove production fallbacks and rotate secrets.
- Remove OTP response/log disclosure.
- Add OTP throttling, expiry, and audit logs.
- Make payment confirmation atomic and idempotent.
- Add upload limits and content validation.

### Sprint 2: Workflow correctness

- Add request transition guards and concurrency tests.
- Add customer payment confirmation or provider integration.
- Fix map layer cleanup and coordinate validation.
- Restrict exact location visibility.

### Sprint 3: Product quality

- Add URL routing and refresh restoration.
- Add loading/offline/error/empty states.
- Add accessibility and responsive-device checks.
- Add unit, integration, and Playwright coverage.

### Sprint 4: Production operations

- Add structured observability and alerting.
- Add backups, retention, storage lifecycle, and admin audit tools.
- Add CI/CD gates and deployment smoke tests.

## Final Assessment

The codebase is in a workable prototype/early production stage: the main flows exist and compile, but security defaults, payment trust, OTP protection, upload handling, location privacy, and test coverage must be addressed before treating the service as production-ready. The immediate release blocker is not Git synchronization; it is ensuring the hosting platforms rebuild the current commit with secure environment variables and that the high-priority backend controls are implemented.
