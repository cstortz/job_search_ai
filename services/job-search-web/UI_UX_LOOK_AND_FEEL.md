# UI/UX Look and Feel Standards

This file defines the default interaction and visual standards for `job-search-web` so new pages behave consistently.

## Core Principles

- Keep data capture and review in one place: form on top, table below.
- Prioritize scanability: clear headers, compact rows, expandable details.
- Make state visible: loading, saving, empty, and error states are always explicit.
- Keep controls predictable: same icon/button behavior on every capture page.

## Page Structure Standard

For CRUD data-capture pages (for example `skills`, `job-sites`):

1. **Card 1: Edit/Create Form**
   - Header with page title and short description.
   - Inline validation and error messaging.
   - Primary submit button (`Create` or `Update`) and secondary cancel when editing.
2. **Card 2: Data Table**
   - Count row: filtered count + total count.
   - Table headers always visible, even when result set is empty.
   - Empty-state message appears in table body, not by replacing table UI.

## Table Interaction Pattern (Default)

- First column is expand/collapse chevron.
- Each primary data column supports:
  - Sort button (icon button).
  - Filter toggle button (icon button).
  - Optional inline filter input shown under the header when toggled.
- Active column rules:
  - Header label is bold when sorted or filtered.
  - All cells in that column are bold when sorted or filtered.
- Expanded row shows metadata and secondary actions (Edit/Delete).

## Icon and Header Styling

- Header text is black (`#111827`) and larger than body text (`font-size: 1rem` baseline).
- Icon-only controls use dark gray (`#4b5563`) with transparent background.
- Icon button border uses neutral gray (`#9ca3af`).
- Do not use high-contrast black fill backgrounds for icon-only table controls.

## State Handling Requirements

- **Loading**: show muted loading text inside the table card.
- **Saving**: disable submit/delete actions while request is in progress.
- **Error**: show a visible error block near form header.
- **No matches**: keep table headers and filter controls visible and show one body row with a no-results message.

## Reuse Guidance

When implementing new pages (`roles`, `applications`, `interviews`, `offers`):

- Start from `SkillsPageClient` or `JobSitesPageClient` table/header interaction model.
- Match sort/filter icon behavior and active-column bolding.
- Keep detail metadata in expandable rows instead of forcing navigation for basic details.

If a page needs a different UX pattern, document the exception in this file with rationale.
