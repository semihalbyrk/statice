# UX Guidelines — Interaction & Behavior

Rules governing user interactions, form behavior, navigation patterns, and interaction consistency.

---

## 1. No Redundant Data Entry

Forms must never require the same data to be entered twice. When a child entity can inherit fields from its parent, those fields should be auto-populated and not shown in the form.

**Why:** Users don't want to enter the same date twice — it's tedious and increases error risk.
**How to apply:** When creating a child form, automatically use known parent fields. Don't display fields that can be derived from context.

---

## 2. Currency Always via Dropdown + Icon

Currency selection must never be a free-text input. Always use a dropdown with currency symbol display.

**Why:** Free text creates input variation risk (`eur`, `Euro`, `€`, `EUR` all mean the same thing).
**How to apply:** For every form with a currency field, use a dropdown with options: EUR (€), USD ($), GBP (£). Display the selected currency's symbol next to amount inputs.

---

## 3. Status Badge & Transition Standardization

All entity lists must use the same `StatusBadge` component for status display. The status column must be the 2nd column. Active/Inactive transitions must be possible directly from the list. When a status component is updated for one entity (e.g. suppliers), all pages using the same pattern (carriers, users, material management) must be updated too.

**Why:** A status improvement made to the Suppliers page wasn't reflected in carrier/users pages — inconsistent UX. Inactive entities must be excluded from form selections and login across the application.
**How to apply:** When making status component changes, use grep to find all usage points and update them all. Ensure inactive entities are filtered from form dropdowns and inactive users are blocked from login.

---

## 4. Kebab (3-Dot) Action Menu Standard

Row action buttons must never be displayed as inline icons side by side. Always use a 3-dot (MoreVertical) kebab menu at the far right of the row. Clicking opens a dropdown listing actions (Edit, Delete, etc.). Use the `RowActionMenu` component. The column header must be empty (no "Actions" text).

**Why:** Consistency with Evreka360 product. Inline icon buttons looked cluttered, especially on rows with many actions (Users: 3 icons side by side).
**How to apply:** When creating or updating list pages, use `RowActionMenu`. Never place inline Pencil/Trash2 buttons.

---

## 5. Complex Objects Get Full Pages, Not Popups

Objects requiring many fields (contract, order, etc.) must not use popup/modal forms. These need dedicated full-page routes with left/right sections and logical groupings (basic info, payment, contamination, material lines).

**Why:** When there are too many fields for a popup, the UX breaks down — layout is constrained, users can't scroll properly.
**How to apply:** When designing a create/edit form, evaluate the field count. If >6 fields or there are logical sections, use a full page instead of a popup.

---

## 6. Status Changes Always via Clickable Badge

Never add separate buttons (Terminate, Deactivate, etc.) for status changes. Status must always be displayed and changed through the `ClickableStatusBadge` component — click it, select the new status. This applies to both list and detail pages.

**Why:** Separate buttons create inconsistent UX — some pages have buttons, others have badges. A single pattern is cleaner.
**How to apply:** When creating entity detail/list pages, always use `ClickableStatusBadge` for status changes. Never add standalone "Terminate", "Deactivate" action buttons.

---

## 7. Add and Edit Pages Must Use the Same Pattern

If the Add flow uses a popup, the Edit flow must also use a popup. If Add uses a full page, Edit must use the same page (in edit mode). Never mix Add=page with Edit=modal.

**Why:** Users feel inconsistency when they see a full page for Add but a popup for Edit. Form fields may also differ because not everything fits in a popup.
**How to apply:** When building entity forms, Add and Edit must share the same component. If `useParams().id` exists, it's edit mode; otherwise, create mode. Routes: `/entity/new` and `/entity/:id/edit`.

---

## 8. Use a Confirmation Dialog Component — Not window.confirm()

Destructive actions (delete, status change to terminal state, etc.) must use a custom `ConfirmDialog` component instead of the browser's native `window.confirm()`.

**Why:** `window.confirm()` is unstyled, cannot be customized, looks out of place in a polished application, and blocks the browser thread.
**How to apply:** Create/use a shared `ConfirmDialog` component with: title, description, confirm button (red for destructive actions), and cancel button. Display it as a centered modal with backdrop. All delete and irreversible actions must route through this dialog.

---

## 9. Field-Level Validation Errors — Not Just Toasts

Form validation errors must be shown both as a toast notification AND inline under the relevant input field. The input border should turn red (`border-red-500`) and an error message should appear below it.

**Why:** Toast-only validation forces users to remember which fields had errors after the toast disappears. Inline errors provide persistent, contextual feedback.
**How to apply:** For required field validation, show `text-red-500 text-xs mt-1` error text below the input. Set the input border to `border-red-500`. Clear the error when the user corrects the value. Keep the toast as a summary ("Please fix the highlighted errors").

---

## 10. Submit Button Loading State

Submit buttons must show a loading state during form submission: disabled state + spinner or text change (e.g. "Creating..." instead of "Create").

**Why:** Without feedback, users may click the button multiple times, causing duplicate submissions or confusion about whether the action is in progress.
**How to apply:** Every form submit button must implement: `disabled={submitting}` with `opacity-50 cursor-not-allowed`, and text change to the "-ing" form of the action (Save → Saving..., Create → Creating..., Update → Updating...).

---

## 11. Search Input Debounce Standard — 300ms

All search/filter text inputs must use a 300ms debounce before triggering API calls or filtering.

**Why:** Without debounce, every keystroke triggers a request, causing unnecessary load and flickering results.
**How to apply:** Use a consistent 300ms debounce on all search inputs. The pattern is already established in InboundsPage — reuse it.

---

## 12. Pagination Standard

All paginated lists must offer the same pagination controls: per-page selector (10/20/50 options), Previous/Next buttons with disabled states, and "Page X of Y" display.

**Why:** Inconsistent pagination controls across pages create cognitive friction and look unpolished.
**How to apply:** Use the established pagination pattern from InboundsPage. Every list page with more than 10 potential items must include pagination.

---

## 13. Breadcrumb Navigation for Nested Pages

Every page deeper than the top-level list must include breadcrumb navigation showing the path hierarchy.

**Why:** Without breadcrumbs, users on detail or edit pages have no visual context of where they are and must rely on the browser back button.
**How to apply:** Use the `Breadcrumb` component (`client/src/components/ui/Breadcrumb.jsx`) on all detail pages, edit pages, and create pages. Format: `List Name > Item Name` or `List Name > Create New`.

---

## 14. Toast Notification Standard

Toast notifications must follow a consistent pattern: position top-right, success toasts auto-dismiss after 3 seconds, error toasts persist until dismissed, and never stack more than 3 toasts simultaneously.

**Why:** Inconsistent toast behavior (different positions, durations, stacking) feels chaotic and can obscure important error messages.
**How to apply:** Configure `react-hot-toast` with: `position: 'top-right'`, success duration: 3000ms, error duration: Infinity (requires manual dismiss). Limit visible toasts to 3 maximum.
