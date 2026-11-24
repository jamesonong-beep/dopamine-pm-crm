# Verification — 2026-11-22 security and recovery update

- TypeScript and real-handler SQLite integration tests pass.
- Coverage: selected project/brand isolation on reads, denied guessed record IDs and cross-project/reference writes, deny-empty scope, owner-only confidential notes, section/financial redaction, permission revocation, read-only memberships.
- Recovery coverage: owner-only downloads and recovery access; JSON export/import round-trip; preview and explicit confirmation; stale-revision rejection; preservation of current memberships; automatic pre-restore/pre-clear safety points; audit survival; corrupted checksum, foreign workspace and invalid relationship rejection; CSV formula escaping; manual retention; write rate limiting.
- Recovery tests run only in isolated in-memory SQLite and do not restore or clear hosted records.
- Local migration adds three tables; existing workspaces schema and records remain unchanged.
- Stage Grid from the preceding update remains unchanged. Pointer drag appearance still needs a manual check; this browser connection does not expose pointer dragging.
- Real hosted restricted login with Justine is pending. No sharing grants or invitations are issued by this update.
- Same-database recovery points are not an independent backup. Downloaded copies require private, separate storage. No automatic offsite backup or alert service is connected.
- Email reminders remain pending a sending account.


2026-11-22 template manager and delivery layout: TypeScript and API regression suite passed, including template lifecycle, invalid reorders, member write denial, task snapshot/dependency preservation and JSON recovery. Local browser verified template creation, ordering, archiving and exclusion from New Project; assignment explanations and default signed-in owner; column keyboard resizing, saved widths after navigation, reset, and no page-wide overflow. Pointer resizing implemented but not exercised by the browser automation.

Contact types and brand warmth: TypeScript and API regression tests passed, including category create/rename validation, stable contact assignment IDs, scoped and owner-only write enforcement, independent brand warmth, and JSON restore. Local browser verified type creation and assignment, rename retaining selection, combined company/brand/type filtering, dependent brand reset, empty results, and Hot brand filtering. Only local test records were changed for QA.
