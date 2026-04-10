# Anti-Pattern Guidelines — Development Process Rules

Rules governing development practices, code quality, and process discipline to prevent recurring mistakes.

---

## 1. Cross-Tab UI Consistency

When updating one tab or section, always check and align related tabs/sections: button alignment, banner style, form patterns, status dot colors, naming.

**Why:** Changes to the Sorting tab weren't applied to the Disassemble tab — the user had to point it out.
**How to apply:** Before completing any UI task, scan sibling components for the same patterns and apply the change to all of them.

---

## 2. Ready-to-Go Setups

Deliver complete, working setups. Never leave scaffolding, empty files, or manual steps for the user.

**Why:** The user expects full end-to-end delivery with verification, not partial work.
**How to apply:** Create all files with real content, verify they work, and report results. No TODO comments, no placeholder implementations, no "you'll need to configure X manually."

---

## 3. Test Data Hygiene

No test data should remain visible in the dashboard after tests run. If mock/seed data is needed, use realistic names consistent with the domain — never use "test updated", "TEST_FEE_123", or similar.

**Why:** Test artifacts clutter the dashboard and are indistinguishable from real data.
**How to apply:** Verify that test `afterAll` cleanup runs completely. In seed data, use realistic Netherlands/WEEE-context names (e.g. "Van der Berg Electronics", "Amsterdam Recycling BV").

---

## 4. PRD Terminology Takes Priority

Terms from the PRD must be used verbatim in the code. If the PRD says "Private Individual", don't use `AD_HOC`. If the PRD says "Third Party", don't use `COMMERCIAL`.

**Why:** When someone reading the PRD can't find the same terminology in the code, confusion follows.
**How to apply:** When creating new enums, models, or UI labels, check the PRD (`docs/PRD.md`) for the correct term and use it exactly.

---

## 5. When Fixing a Page, Scan ALL Pages Using the Same Pattern

When a bug is fixed on one list/page, all other pages using the same structure (table, dropdown, overflow, styling, etc.) must be automatically scanned and given the same fix. Fixing only the reported page is not enough.

**Why:** A user reporting a problem on one page shouldn't have to report the same problem on every other page individually. Lack of comprehensive thinking forces the user to repeat themselves.
**How to apply:** After every fix, use grep/glob to find all files using the same pattern (className, component, or structural pattern). If the same issue exists elsewhere, apply the fix everywhere. This must be automatic — the user should never have to enumerate pages one by one.

---

## 6. No Inline Styles — Always Use Tailwind Classes

Never use the `style={{}}` prop for styling. All visual styling must go through Tailwind utility classes.

**Why:** Inline styles bypass the design system, can't be overridden by Tailwind responsive/state variants, and make the styling inconsistent and harder to maintain.
**How to apply:** Convert any `style={{}}` used for layout, colors, spacing, or sizing to equivalent Tailwind classes. The only acceptable use of inline `style` is for truly dynamic values computed at runtime (e.g. `style={{ width: `${percentage}%` }}`).

---

## 7. Don't Recreate Existing Shared Components

Before building a new component, check if a shared component already exists in `client/src/components/`. If a similar component exists, extend or reuse it — don't create a duplicate.

**Why:** Duplicate components lead to divergent behavior, double maintenance burden, and inconsistent UX as one gets updated but not the other.
**How to apply:** Before creating any new UI component, search `client/src/components/` for similar functionality. Key shared components: `StatusBadge`, `ClickableStatusBadge`, `RowActionMenu`, `Breadcrumb`, `Skeleton`, `SupplierTypeBadge`. If what you need doesn't exist, create it in the shared directory — not inside a page-specific folder.

---

## 8. No Magic Numbers — Use Design Tokens

Don't use arbitrary pixel values for spacing, sizing, or layout. Use Tailwind's spacing scale (which maps to design tokens) or explicit token values.

**Why:** Magic numbers like `mt-[13px]` or `w-[347px]` are meaningless, inconsistent, and can't be systematically updated.
**How to apply:** Use Tailwind's standard spacing scale (`p-4`, `gap-3`, `mt-6`, etc.). If a custom value is genuinely needed for layout reasons, document why with a comment. For widths, prefer responsive constraints (`max-w-md`, `w-full`, percentage-based) over fixed pixel values.

---

## 9. Translation Key Naming Convention

Translation keys must follow the pattern: `namespace:section.key`. Namespace matches the i18n file (e.g. `orders`, `common`, `admin`). Section groups related keys. Key is the specific item.

**Why:** Inconsistent key naming makes translations hard to find, leads to duplicates, and makes the i18n files difficult to maintain.
**How to apply:** Examples: `orders:status.PLANNED`, `common:buttons.save`, `admin:users.roleLabel`. Never use flat keys like `orders:saveButton`. Always check existing translation files for the correct namespace before adding new keys.

---

## 10. No Direct API Calls in Components — Use the API Layer

Components must never call `axios` or `fetch` directly. All API calls must go through the centralized API layer in `client/src/api/`.

**Why:** Direct API calls scatter auth header logic, base URL configuration, and error handling across the codebase. The API layer handles these concerns centrally.
**How to apply:** For every new endpoint, create or update the corresponding file in `client/src/api/`. Components import and call these API functions. Never import `axios` directly in a page or component file.

---

## 11. No Console.log in Production Code

Remove all `console.log`, `console.debug`, and `console.info` statements before committing. Only `console.error` and `console.warn` are acceptable for genuine runtime issues.

**Why:** Console logs clutter the browser devtools, may leak sensitive data, and signal unfinished code.
**How to apply:** Before completing any task, search for `console.log` in modified files and remove them. Use proper error handling (toast notifications, error boundaries) instead of logging to the console.
