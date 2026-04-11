# SumTrack UI Normalization Standard

This file is the copy-paste baseline for normalizing dashboard pages.

Source-of-truth pages:
- `Manage User Accounts`
- `Create User` (form structure + validation behavior)
- `Audit Log`
- `Reports`

## 1) Global Controls and Surfaces
- Controls (`Input`, `SelectTrigger`, filter buttons) must be `!h-11`.
- Border radius must be `rounded-md`.
- Default control class:
  - `!h-11 rounded-md bg-white py-0 text-sm dark:bg-background`
- Standard surfaced container:
  - `rounded-md border border-border/70 bg-card shadow-sm`

## 2) Header and Breadcrumb
- Use `DashboardHeaderConfigurator` on destination pages.
- Header format: nav-matching icon + title + concise description.
- Shell should auto-resolve fallback header/breadcrumb for loading transitions.
- Breadcrumb should match actual destination context, not generic placeholders.

## 3) Page Layout
- Use `space-y-4` as baseline vertical rhythm.
- Keep content task-first: filters/form first, avoid filler blocks.
- For list pages:
  - Filters/search row first
  - Primary create action on the right
- For form pages:
  - Use `Create User`-style grouped sections
  - Keep compact density and clear separators

## 4) Search + Filter Row
- Rule:
  - If there is **no search bar**, filters stay on the **left**.
  - If there **is** a search bar, search stays on the **left** and filters stay on the **right**.
- Search input includes left icon.
- Use shadcn select with label grouping:
  - `SelectGroup`
  - `SelectLabel`
  - `SelectItem`
- Keep filter widths consistent per page.

## 5) Tabbing Pattern
- Reuse Reports-style separator tabs:
  - Bottom border separator
  - Active tab has colored indicator
  - Icons align with tab semantics
- Selected tab:
  - icon and underline accent color
  - text remains readable in standard foreground unless a page explicitly needs otherwise

## 6) Data Table Pattern
- Use Manage User Accounts table behavior as baseline:
  - White header row (not gray-tinted blocks unless intentionally required)
  - Row hover state is visible
  - Consistent padding and text weights
- Multiple row actions go inside kebab menu.
- Hide explicit `Actions` text header; keep sr-only label if needed for accessibility.
- Pagination is visually separated from the table container.

## 7) Pending/Debounce Overlay
- Overlay must cover table region only.
- Pagination controls must stay interactive/visible outside overlay.

## 8) Form Validation Pattern
- Do not show invalid states on initial load.
- Show invalid only on submit attempt and/or touched-state rules.
- Required field invalid contract:
  - set `aria-invalid` on invalid input/select
  - set `data-invalid` on field wrapper for styling
- Clear invalid styling immediately after valid input.

## 9) Skeleton and Loading
- Provide dedicated page skeletons for each major page.
- Skeleton should reflect latest live layout (not old container shapes).
- Skeleton contrast must be visible in light mode (avoid near-background tones).
- Header/breadcrumb should resolve coherently with page loading state.

## 10) Buttons and Actions
- Primary create/generate buttons:
  - `h-11 rounded-md`
  - consistent SumTrack green treatment used by source pages
- Prefer icon + label (`+ Create User`, `+ Generate Report`) with consistent spacing.

## 11) Badges
- Reuse Manage User Accounts badge proportions:
  - `rounded-md`
  - `py-1`
  - balanced border/background contrast
  - avoid borderless light-mode zinc badges where not intentional
- Role badges must use the exact same role palette/class behavior as Manage User Accounts.

## 12) Do/Don’t Summary
- Do: keep pages focused, dense, and form/task oriented.
- Do: reuse existing primitives and patterns first.
- Don’t: introduce one-off spacing systems or alternate control heights.
- Don’t: mix old and new layout shells in the same page.

---

If a page needs an exception, document it in that page module as a short comment explaining why.
