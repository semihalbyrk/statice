# Accessibility Guidelines — A11y Standards

Rules ensuring the application is usable by everyone, including users with disabilities, keyboard-only users, and screen reader users. Target: WCAG 2.1 Level AA compliance.

---

## 1. ARIA Labels on All Interactive Elements

Every interactive element (button, link, input, select, toggle) must have an accessible name. Use `aria-label` for elements without visible text, or ensure a visible `<label>` is properly associated.

**Why:** Screen readers announce interactive elements by their accessible name. Without it, users hear "button" or "link" with no context.
**How to apply:** All `<button>` elements with only an icon (e.g. kebab menu, close button, search icon) must have `aria-label`. All `<input>` elements must have an associated `<label htmlFor>` or `aria-label`. Verify with: inspect element → Accessibility tab → check "Name" is populated.

---

## 2. Keyboard Navigation — Tab Order and Activation

All interactive elements must be reachable via Tab key and activatable via Enter or Space. The tab order must follow the visual layout (left-to-right, top-to-bottom).

**Why:** Users who cannot use a mouse rely entirely on keyboard navigation. If elements are unreachable or out of order, the application is unusable.
**How to apply:** Use semantic HTML (`<button>`, `<a>`, `<input>`) which provides keyboard support by default. Never use `<div onClick>` for interactive elements — use `<button>` instead. If a custom component must use a div, add `role="button"`, `tabIndex={0}`, and `onKeyDown` handling for Enter/Space.

---

## 3. Modal Focus Trap

When a modal or dialog opens, focus must move into the modal and remain trapped inside it until the modal is closed. On close, focus must return to the element that triggered the modal.

**Why:** Without focus trapping, Tab moves focus behind the modal where users can interact with invisible elements. This is disorienting and breaks the interaction model.
**How to apply:** When building modals: (1) On open, move focus to the first focusable element inside the modal. (2) On Tab at the last element, wrap to the first. (3) On Shift+Tab at the first element, wrap to the last. (4) On Escape, close the modal. (5) On close, restore focus to the trigger element. Consider using a library like `@headlessui/react` or `react-focus-lock`.

---

## 4. Screen Reader Announcements for Dynamic Content

Status changes, toast notifications, form submission results, and loading state transitions must be announced to screen readers via ARIA live regions.

**Why:** Visual-only feedback (color changes, toast popups, spinner animations) is invisible to screen readers. Without announcements, blind users don't know what happened.
**How to apply:** Toast container: add `aria-live="polite"` and `role="status"`. Loading states: add `aria-busy="true"` to the loading container. Status badge changes: wrap in `aria-live="polite"` region. Error messages: use `role="alert"` for immediate announcement.

---

## 5. Color Contrast Ratios — WCAG AA Minimum

All text must meet WCAG AA contrast ratios: 4.5:1 for normal text, 3:1 for large text (18px+ or 14px+ bold).

**Why:** Low-contrast text is unreadable for users with low vision, color blindness, or in bright lighting conditions.
**How to apply:** Verify that `text-grey-400` and `text-grey-500` are not used for important information — they often fail contrast checks on white backgrounds. Use `text-grey-600` or darker for any meaningful text. Status badge text colors must contrast sufficiently against their background color. Use browser DevTools → Accessibility → Contrast ratio checker to verify.

---

## 6. Minimum Touch Target Size — 44x44px

All interactive elements (buttons, links, checkboxes, dropdown triggers) must have a minimum touch target of 44x44 pixels.

**Why:** Small touch targets are difficult to activate on touch devices, especially for users with motor impairments.
**How to apply:** Buttons: minimum `h-10 min-w-[44px]` (40px is acceptable per WCAG if spacing is sufficient). Icon buttons: add padding to reach the minimum (`p-2` on a 24px icon = 40px). Table row action menus: ensure the clickable area is large enough, not just the icon itself.

---

## 7. Skip Navigation Link

Add a "Skip to main content" link as the first focusable element on the page, visible only on focus.

**Why:** Keyboard users must Tab through the entire sidebar and topbar navigation on every page load to reach the main content. A skip link lets them jump directly to the content area.
**How to apply:** Add a visually hidden (but focusable) `<a href="#main-content">Skip to main content</a>` as the first child of `<body>` or `AppLayout`. Add `id="main-content"` to the main content area. Style: `sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:p-3 focus:rounded-md focus:shadow-lg`.

---

## 8. Form Error Association

Form validation error messages must be programmatically associated with their input fields using `aria-describedby`. Invalid inputs must have `aria-invalid="true"`.

**Why:** Screen readers need explicit association to announce which error belongs to which field. Without it, users hear the error text but don't know which input to fix.
**How to apply:** Pattern:
```jsx
<input
  id="email"
  aria-invalid={!!errors.email}
  aria-describedby={errors.email ? "email-error" : undefined}
/>
{errors.email && <p id="email-error" role="alert">{errors.email}</p>}
```
Every input with validation must implement this pattern.

---

## 9. Icon-Only Buttons Must Have Accessible Names

Buttons containing only an icon (no visible text) must always have `aria-label` describing the action.

**Why:** Screen readers announce these as just "button" with no indication of what the button does.
**How to apply:** Examples:
- Kebab menu: `aria-label="Row actions"` or `aria-label="Actions for {item name}"`
- Close button: `aria-label="Close"`
- Search icon button: `aria-label="Search"`
- Edit icon: `aria-label="Edit {entity name}"`
The label should describe the action, not the icon (say "Close" not "X icon").

---

## 10. Table Accessibility

Data tables must include proper semantic markup for screen readers.

**Why:** Screen readers use table semantics to navigate cells, announce column headers, and provide context. Without proper markup, tables become an incomprehensible grid of text.
**How to apply:**
- Use `<table>`, `<thead>`, `<tbody>`, `<th>`, `<td>` (never div-based tables)
- Add `scope="col"` to all `<th>` elements in `<thead>`
- Consider adding `<caption>` or `aria-label` to describe the table's purpose
- For sortable columns, indicate sort state with `aria-sort="ascending"` / `"descending"` / `"none"`
- Empty cells should contain `—` (em-dash) rather than being blank

---

## 11. Visible Focus Indicators

All focusable elements must have a visible focus indicator (outline or ring) that is clearly distinguishable from the element's default state.

**Why:** Keyboard users need to see where focus is. Without a visible indicator, they are navigating blind.
**How to apply:** The existing `focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15` pattern on inputs is good — extend it to all interactive elements. Never use `outline-none` without providing an alternative focus style. Buttons, links, and custom interactive elements must all show a visible focus ring. Test by pressing Tab through the entire page — focus should never "disappear."

---

## 12. Decorative vs. Meaningful Images and Icons

Decorative images/icons must have `aria-hidden="true"`. Meaningful images must have descriptive `alt` text.

**Why:** Screen readers will attempt to read decorative images, creating noise. Conversely, meaningful images without alt text provide no information.
**How to apply:**
- Icons inside buttons with text labels: `aria-hidden="true"` (the button text provides the accessible name)
- Standalone icons conveying meaning: provide `aria-label` or adjacent visually hidden text
- Logo images: `alt="Statice MRF Dashboard"` or similar
- Status indicator icons (colored dots): ensure the status is also conveyed via text, not just color
