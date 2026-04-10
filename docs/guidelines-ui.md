# UI Guidelines — Visual Consistency & Styling

Rules governing visual presentation, styling patterns, and visual consistency across the application.

---

## 1. List View Consistency

All list/table pages must follow the same padding, font, and empty-value patterns. Reference: InboundsPage.

- `<td>` padding: `py-3` (not `py-2.5`)
- Primary identifier column: `font-medium text-green-700` (only if clickable — see Rule 4)
- Empty values: always `—` (em-dash), never `-` or empty string
- Status column: always the 2nd column
- Table `min-w-[...]` to prevent horizontal squashing

**Why:** A readability fix applied to the Inbound list was not propagated to other lists — every page looked different.
**How to apply:** Use InboundsPage as the reference when building new list pages. When updating existing pages, follow these rules.

---

## 2. Never Display Raw Enum Values in the Frontend

Never show backend enum values (e.g. `FINANCE_MANAGER`, `SORTING_EMPLOYEE`) directly in the UI. Create a `LABELS` map for every enum and convert to human-readable format. Badge coloring is not always necessary — plain text may suffice (e.g. role column).

**Why:** Uppercase, underscored values like `FINANCE_MANAGER` look terrible in the UI.
**How to apply:** When introducing a new enum, immediately create a LABELS map. Cover all values — never leave a label missing.

---

## 3. Non-Clickable Text Must Not Use Link Colors

Never style non-clickable text with `text-green-700` or `text-green-500` (hyperlink-like colors). Green should only be used for genuinely clickable links and actions. Non-clickable identifiers should use `text-grey-900 font-medium`.

**Why:** Users click green text expecting an action, but nothing happens — misleading UX.
**How to apply:** For identifiers inside nested/accordion views (material code, fraction code, etc.), use `text-grey-900`. Only use green where navigation actually occurs (e.g. link to detail page).

---

## 4. Form Action Buttons Aligned Right

Cancel and Submit buttons (Update, Create, etc.) in full-page forms must always be right-aligned using `justify-end`.

**Why:** Left-aligned buttons get lost on wide form pages and violate UX standards.
**How to apply:** Apply `flex justify-end gap-3` to all full-page form action button containers. Check all pages using the same pattern — not just the one reported.

---

## 5. No Hardcoded Colors — Always Use Design Tokens

Never use raw hex values, `rgb()`, or `rgba()` in components. Always use Tailwind classes mapped from `design-tokens.json` or CSS variables from `tokens.css`.

**Why:** Hardcoded colors drift from the design system, make theming impossible, and create inconsistency. Multiple instances of raw `rgba(16, 24, 40, ...)` and `rgb(34 197 94)` already exist in the codebase.
**How to apply:** Use Tailwind classes like `bg-green-600`, `text-grey-900`, `border-grey-200`. For opacity, use Tailwind's built-in opacity modifiers (`bg-green-500/15`). If a needed color doesn't exist in tokens, add it to the design system — don't hardcode it.

---

## 6. Use Skeleton Loaders Instead of "Loading..." Text

Tables and content areas should display skeleton/shimmer placeholders during loading, not plain "Loading..." text.

**Why:** Skeleton loaders provide a visual hint of the upcoming layout, reduce perceived load time, and look significantly more polished than plain text.
**How to apply:** Use the existing `Skeleton` component (`client/src/components/ui/Skeleton.jsx`) for loading states. For tables, render 3-5 skeleton rows matching the column layout. For cards, render skeleton blocks matching the card dimensions.

---

## 7. Empty State Design — Text + Call-to-Action

Empty lists should not just show a grey "No items found" message. Include a descriptive message and, where applicable, a primary action CTA (e.g. "Create your first order").

**Why:** Empty states are a key onboarding moment. A bare text message provides no guidance and looks unfinished.
**How to apply:** For entity list pages, when the list is empty AND no filters are active, show a centered empty state with: icon (optional), descriptive text, and a CTA button linking to the create flow. When filters are active but no results match, show "No results match your filters" without CTA.

---

## 8. Card and Section Styling Consistency

All card/section containers must use the same base styling pattern:
`bg-white rounded-lg border border-grey-200 shadow-sm p-5`

**Why:** Inconsistent card styling (different border radii, shadows, padding) creates visual noise and makes the interface feel unpolished.
**How to apply:** When creating new sections, cards, or form containers, use the standard card class pattern. If a variation is needed (e.g. nested card), reduce to `p-4` and `shadow-none` but keep border and radius consistent.

---

## 9. Shadow and Elevation Consistency

Always use shadow values from the design token system (`shadow-xs` through `shadow-3xl`). Never use custom `box-shadow` declarations in inline styles or component CSS.

**Why:** Custom shadow values like `box-shadow: 0 28px 80px rgba(16, 24, 40, 0.28)` diverge from the design system and create inconsistency.
**How to apply:** Cards use `shadow-sm`. Modals use `shadow-xl`. Dropdowns/popovers use `shadow-lg`. Check `docs/design-tokens.json` for the full shadow scale.

---

## 10. Responsive Typography

Font sizes should adapt to screen size for key UI elements. Don't use the same `text-sm` everywhere regardless of viewport.

**Why:** Text that's readable on desktop can be too small on mobile, and headings sized for desktop can overwhelm a mobile screen.
**How to apply:** Page titles: `text-lg md:text-xl lg:text-2xl`. Section headings: `text-base md:text-lg`. Body/table text: `text-sm` is acceptable across breakpoints. Use Tailwind responsive prefixes (`sm:`, `md:`, `lg:`) for typography where needed.
