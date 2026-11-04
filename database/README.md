# PostgreSQL domain draft

This folder models the current local PMS frontend in `frontend/legacy`. It is a standalone PostgreSQL design draft. It does not integrate with or change the existing Nest backend, its configuration, or its migrations.

Apply the schema once to an empty database, then load demonstration records. Configure PostgreSQL through your own `PGHOST`, `PGPORT`, `PGDATABASE`, and `PGUSER` environment values. No connection strings or credentials are included.

```sh
psql -X -v ON_ERROR_STOP=1 -f database/schema.sql
psql -X -v ON_ERROR_STOP=1 -f database/seed.sql
```

Both files use transactions. The schema is intentionally not a rerunnable migration. The seed uses stable identifiers, fixed dates, and `ON CONFLICT DO NOTHING`: rerunning it preserves existing records and their historical timestamps. It does not reset edited demo records. Use an empty database when you need the exact baseline dataset.

The seed contains 634 rows across all 41 tables:

- Two companies, separate departments, ten primary-company employees (including an inactive employee), and one employee in another company. Current and historical reporting lines accompany identity-provider subjects and Employee, Manager, HR Administrator, and System Administrator role assignments. All email addresses use the reserved `.example` domain; identity subjects are placeholders, not login credentials.
- Assigned and personal goals, milestones, progress updates, pending manager approval, completion, and cancellation.
- Position-specific KPI and behavioral template versions, published definitions, independent draft revisions, higher/lower indicators, reference matrices, optional matrix scoring bands, rating questions, written answers, and Not Observed responses.
- Draft, scheduled, active, and completed review cycles; five sequential evaluator stages; reviewer assignments and anonymous peer/upward feedback; frozen employee/template/result snapshots; returned accomplishments and retained resubmissions; release and acknowledgment metadata.
- Coaching journals, evidence metadata, and draft, issued, responded, closed, and cancelled NTEs. Scenarios include an overdue response, normal closure, and a separately documented early closure exception.
- All seven frontend PIP states: Awaiting Planning, Draft, Active, Completed, Completed with Exclusions, Not Met, and Cancelled. Sources retain employee/evaluation provenance, including two evaluations with the same indicator. Weekly records cover exclusions, seven-day periods, follow-ups, returns/resubmissions, missed employee updates, assessment outcomes, acknowledgment, cancellation, and closure.
- Domain histories, user/system audit events, and read/unread notifications linked to workflow records.

Evidence rows represent metadata only. The seed does not upload files; `demo-only/` storage keys do not identify usable attachments. Dates are fixed around 2026-11-03 so scenario assertions remain deterministic.

## Checks

The lightweight coverage test requires only Node.js:

```sh
node --test database/schema.test.mjs
```

The integration test requires `psql` and an existing disposable PostgreSQL database. It creates a private schema, applies the draft and seed, compares every row before and after a rerun, exercises invalid records, and drops the private schema in `finally`. It inherits your PostgreSQL environment without printing credentials:

```sh
PMS_DATABASE_TEST=1 node --test database/schema.test.mjs
```

The integration test validates real foreign keys and checks for company boundaries, evaluation/template and evaluator/stage consistency, progress and rating limits, NTE/PIP closure details, seven-day weekly periods, and self-reference errors. It explicitly skips unless `PMS_DATABASE_TEST=1`; the lightweight coverage test still runs.

## Design boundaries

This draft stores authorization inputs and history; it does not implement authentication, row-level security, application permissions, file access, notification delivery, or an automatic audit trigger. Published versions, frozen snapshots, submitted responses, and audit/history records still require backend write protection. Anonymous evaluator identities remain available to privileged database access, so a future API must enforce release visibility and minimum-response thresholds.

Foreign keys protect principal company boundaries and source provenance. Cross-row workflow rules still require backend transactions or additional database enforcement: permitted state transitions, active evaluator eligibility, date/stage ordering, weekly overlap, follow-up ordering and matching indicator provenance, direction-specific scores, matrix definition validation, per-version indicator weights, automatic referral deduplication, failed-indicator coverage/exclusion rules, response/closure timing, and completed-plan outcome calculation. NTE closure records contain outcome and exception fields, but this draft does not determine whether a response window may close. A future implementation must validate these rules before exposing writes.
