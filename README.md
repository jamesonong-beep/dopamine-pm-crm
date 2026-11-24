# DOPAMINE — Projects & CRM

Independent project and CRM app. DOPAMINE means: Diligent Organization. Precise Actions. Mindful Intention Nurtures Excellence. Existing client, brand, project and activity records are preserved.

## Included
- My Day by signed-in assignee, date and work role; tasks, waiting dependencies, CRM follow-ups and approvals to chase.
- In-app notification inbox for due/overdue tasks and follow-ups. Reading does not complete work. Rescheduling creates a new reminder identity. Each user has separate read state; the open app refreshes every minute and on focus.
- Seven-stage sales pipeline: New leads; First Pitch and Data Gathering; Discovery; Proposal Sent; Negotiations; Verbal Commit; Contract Signed.
- Compact collapsible deal cards, stage colors, drag-and-drop and stage selector; Lost board with loss reason, previous stage and reopening.
- Collapsible contact cards, manual relationship warmth, touchpoint count/last contact, and follow-up coverage filters.
- Assignment-level work roles, shared person/role filters, actor and owner filtering in Activity.
- Owner directory, editable task owners/dates, project timelines and custom statuses; dependency and closeout rules remain enforced.
- Company → brand → project hierarchy, supplier assignments, waiting and versioned approvals.
- D1 persistence with optimistic concurrency, input validation and same-origin writes.

## Member access
Sites authenticates each visitor. The owner configures app membership by trusted sign-in email and separately authorizes site entry via Sites sharing. No invitations are sent by the app. Until real emails are supplied and invited, the published audience remains owner-only.

App memberships grant visible sections, read-only or edit access, and optional financial access. Server responses omit inaccessible section data, costs and prices. Financially restricted users see generic activity descriptions for their permitted sections. Membership administration, status definition edits, directory changes and clearing data remain owner-only. Work roles never grant permissions. Access-design previews remain simulations; they are not client/supplier portals. Memberships default to selected records (empty means no business records). The owner explicitly grants companies, brands or projects; an optional all-records grant includes future records. Companies include their brands/projects; brands include their CRM records and projects; individual projects grant delivery records only. Both GET projections and POST record/reference checks enforce scope. Restricted scopes do not receive free-text activity history. Confidential project notes are owner-only, independent of financial access.

The first authenticated owner initializes an empty database. Later unknown users are rejected; membership removal revokes shared data access. Existing owner datasets retain their IDs. This release assumes one owner workspace, with invited internal members.

## Reminder delivery limitation
In-app reminders are implemented. Email delivery and a cloud sending schedule are NOT enabled. The owner has requested email reminders; sender address/account connection is still pending. No test emails, external invitations, or emails to sample contacts have been sent. Do not present a stored follow-up date or an in-app read receipt as proof of email delivery.

## Branding
FMG product branding and logo were removed from the UI and favicon. Product name: DOPAMINE. The attached color-book photo inspired working digital colors: pink #E7B9B0, red #AA3931, pale lemon #F4EDB6, cinnamon #C79D68, yellow #E8C926, dark ink #302822. These are not calibrated print swatches. The existing hosting address is retained for continuity.

## Checks
- `npx tsc --noEmit`
- `node tests/workspace-api.mjs` (Node with node:sqlite; isolated in-memory database, no production writes)
- `node /absolute/path/to/sites/scripts/build-site.mjs`

## Backups, exports and security log
The owner-only Backups & exports screen offers manual recovery points, JSON downloads, per-dataset CSV exports, validated restore previews and the latest 100 security events.

- Before the first successful change of each Manila day, a recovery point captures the previous state. Daily points expire after 30 days on the next cleanup. No change means no new daily point; this is change-triggered, not a timer job.
- Keep the newest 20 manual and 20 pre-restore/pre-clear points. Recovery points share the same D1 database and are not offsite disaster recovery.
- Download JSON regularly and store it separately in private encrypted storage. Downloads themselves are unencrypted and include confidential records. The app does not automatically upload to Drive, email, or external storage.
- JSON includes a format version, original workspace identity and SHA-256 corruption checksum. It excludes memberships and reminder-read state. A checksum detects corruption, not malicious editing by an owner.
- Restore validates format, workspace, checksum, field types and record relationships; previews counts; requires RESTORE WORKSPACE and unchanged revision. It atomically saves a safety point and replaces records while preserving current member permissions/directory identities and the separate security log. An uploaded backup is only accepted for its original workspace.
- CSV has record IDs, UTF-8 BOM, quoting and formula-prefix escaping for spreadsheet safety. CSV is not a complete restore format.
- Security events are stored separately, with no app edit/delete endpoint. They survive restores and clearing; database operators could still alter them. They are not a tamper-proof third-party audit service. No external security alert delivery is configured.
- Per-account write/recovery request limits are enforced in D1. This does not replace platform protection, a penetration test or recovery from a destroyed database.

## Not included
Per-brand client/supplier portals, independent reviewer authentication, file storage, ad-platform reporting, procurement/billing, CRM data migration or email delivery. The app does not modify or connect to crm.presto.ph.


Project templates are now workspace records. The owner can create, edit, archive, restore, and reorder them in Project Templates. Active templates appear in project creation; their ordered tasks are copied into a dependency chain. Changes to a template do not alter existing projects. Templates are included in JSON recovery and CSV export. Older workspaces and backups receive the three initial templates when the field is absent.

Created-by attribution comes from the signed-in user. Project/task owner is the responsible person; the assignment role describes their function and grants no access. Delivery Board columns resize using pointer edges or keyboard Left/Right; Home resets one column, Reset Columns resets all. Width preferences are stored per user in the current browser.

## Contact categories and brand warmth
Contacts have an optional type selected from shared contactTypes records. The owner adds and renames types in Contacts → Manage Contact Types; stable IDs keep assignments when names change. Editors can change a permitted contact's type on its expanded card. Contacts combine company, dependent brand, type, warmth, touchpoint, person, role and search filters; Clear Contact Filters resets them. Existing contacts remain Unspecified until categorized. Brand warmth is a separate manual Unrated/Cold/Warm/Hot field with filtering in Companies & brands; it does not change contact warmth. Record-scope authorization applies to both new mutations; only company/brand-authorized editors may update a brand's warmth. New fields and categories are included in JSON recovery and CSV exports.
