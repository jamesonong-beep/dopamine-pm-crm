# Session Handoff (`HANDOFF.md`)

- **Date:** 2026-11-25
- **Branch:** `main`
- **Last AI used:** Gemini

## What Changed
- Completed full card editability, customizable dropdown lists, searchable inline-create dropdowns, and form/contact-row UI polish across **DOPAMINE — Projects & CRM** (compatible with both **Cubist Prism** and **Warm Terracotta** themes):
  - **Remaining 2 cards now editable:** Owner-only **Confidential Notes** in the Project drawer (`confidentialNoteEdit`, with Undo and owner-only enforcement) and **resolved Waiting On items** (`Edit` button now appears on resolved items too, allowing edits to fields and `resolution`).
  - **Customizable dropdown lists:** Added workspace-level `workRoles`, `docTypes`, `touchpointChannels`, and `projectStatuses` in `lib/model.ts`, `app/api/workspace/route.ts`, `app/documents-panel.tsx`, `app/reports-panel.tsx`, `app/deal-details-panel.tsx`, and `app/workspace.tsx` with owner-only `listItemSave` (add + cascading rename across existing records) and `listItemRemove` (min 1 item, `'Complete'` protected in `projectStatuses`, clears `typeId` on contacts when removing a contact type), plus a **Lists & dropdowns** manager under **Team & Settings → Members & access**.
  - **Searchable dropdowns with inline "+ Create":** Added `components/ui/creatable-select.tsx` and wired searchable inline creation for **Company**, **Brand** (scoped to selected company), **Contact**, **Contact type**, **Work role (hat)**, **Document type**, and **Touchpoint channel** across Add/Edit Contact, Opportunity, Project, Touchpoint, Meeting, and Document modals (respecting user permissions and returning `createdId`/`createdValue` so newly created items auto-select immediately).
  - **Form & Contact row UI polish:** Aligned `Optional` tags inline beside field labels so 2-column forms stay level, pinned `.modal-actions` (**Cancel / Save**) as a sticky footer at the bottom of modal dialogs, made **Relationship owner** optional/non-blocking on Contacts (with `Unassigned` and legacy value preservation), and added a one-click **Edit** button on collapsed Contact rows.
- Bumped app version to `v0.1.3` in `package.json` and `package-lock.json` so **Team & Settings → Members & access → App information** clearly confirms when this release is live.

## Verification
- `npx tsc --noEmit`: Passed (0 errors)
- `node tests/workspace-api.mjs`: Passed (14 test suites, including customizable dropdown lists, inline creation IDs, `confidentialNoteEdit`, resolved `waitingEdit`, optional contact owner, and restricted-member `403` checks)
- `npm run build`: Passed (`vinext build` at `0.1.3`; route classification warning only)

## Next Steps / Open Issues
- Push `main` to GitHub and publish to the live pilot site when ready.
- Perform live two-account browser testing across inline Company/Brand creation, the **Lists & dropdowns** manager, and both Cubist Prism and Warm Terracotta themes.
- Review `handoffs/GEMINI-REVIEW-PILOT-v2.md` for remaining Pilot v2 notes (`sharedWork` undo `expectedRevision` and cross-company meeting link validation).

## Repository Background
- Initialized from `DOPAMINE-Rev8-Shared-Pilot-v2-2026-11-24.zip`.
- `AGENTS.md` and `CLAUDE.md` define shared session workflows for Codex, Claude, and Gemini.
