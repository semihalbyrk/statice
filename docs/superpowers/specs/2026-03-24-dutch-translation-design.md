# Dutch Translation (i18n) — Design Spec

## Goal

Add full Dutch (Nederlands) translation to the Statice MRF Dashboard. Users can switch between English and Dutch via a language selector in the sidebar. All UI text — page titles, form labels, buttons, table headers, status labels, toast messages, error messages, placeholders, empty states — must be translated.

## Architecture

**Library:** react-i18next + i18next + i18next-browser-languagedetector

**Translation files:** JSON, namespaced by module under `client/src/i18n/{locale}/`.

**Language persistence:** localStorage via i18next-browser-languagedetector. No backend involvement.

**Rendering:** `useTranslation()` hook with namespace parameter. Components re-render automatically on language change.

## File Structure

```
client/src/i18n/
├── index.js              # i18next init + config
├── en/
│   ├── common.json       # Buttons, statuses, roles, enums, empty states, confirms
│   ├── nav.json          # Sidebar + breadcrumbs
│   ├── auth.json         # Login page
│   ├── dashboard.json    # Dashboard page
│   ├── orders.json       # Orders list, detail, create, planning board
│   ├── inbounds.json     # Inbounds list
│   ├── weighing.json     # Weighing event page
│   ├── sorting.json      # Sorting page, process list
│   ├── contracts.json    # Contracts dashboard, detail, create, modals
│   ├── invoices.json     # Invoices list, create, detail
│   ├── admin.json        # Users, carriers, suppliers, materials, fees, settings, audit
│   ├── reports.json      # Reports page, schedules
│   ├── arrival.json      # Arrival registration
│   └── errors.json       # 404, 403 pages
└── nl/
    └── (identical keys, Dutch values)
```

## Namespace Strategy

Each page imports its module namespace + `common`:

```jsx
const { t } = useTranslation(['orders', 'common']);
// Page-specific: t('orders:title')
// Shared:        t('common:save')
```

### common.json Contents

Shared across all pages:
- **Buttons:** save, cancel, delete, edit, create, close, confirm, back, next, search, add, remove, update, loading, submit
- **Status labels:** All OrderStatus, InboundStatus, ContractStatus, AssetStatus, ProcessingRecordStatus values
- **Role labels:** All UserRole enum display values
- **Enum labels:** Container types, supplier types, pricing models, rate types, fee types, invoicing frequencies, currencies, treatment routes, WEEE categories
- **Table patterns:** "Loading...", "No data found", "{count} total", pagination text
- **Confirm dialogs:** "Are you sure?", "This action cannot be undone"
- **Toast patterns:** "{entity} created", "{entity} updated", "{entity} deleted", "Failed to {action}"
- **Empty values:** "—" (em-dash)

## Language Selector

Location: Sidebar bottom, above user card / logout button.

```
┌─────────────────────┐
│  ...nav items...     │
│                      │
│  ┌─────────────────┐ │
│  │ 🌐  English   ▾ │ │  ← dropdown: English / Nederlands
│  └─────────────────┘ │
│  ┌─────────────────┐ │
│  │ 👤 User Name    │ │
│  │    Role Label   │ │
│  └─────────────────┘ │
│  [Logout]            │
└─────────────────────┘
```

Component: `LanguageSelector` — simple dropdown that calls `i18n.changeLanguage('nl')`. No Zustand store needed; i18next manages language state internally and triggers re-renders through `useTranslation`.

## Date & Number Formatting

`client/src/utils/formatDate.js` — replace hardcoded `'en-GB'` with dynamic locale:

```javascript
import i18n from '../i18n';

const LOCALE_MAP = { en: 'en-GB', nl: 'nl-NL' };

export function formatDate(date, options) {
  const locale = LOCALE_MAP[i18n.language] || 'en-GB';
  return new Date(date).toLocaleDateString(locale, options);
}
```

Number formatting (weights, currency) also respects active locale via `toLocaleString(locale)`.

## Translation Key Convention

Flat keys with dot-separated grouping for nested concerns:

```json
{
  "title": "Orders",
  "newOrder": "New Order",
  "searchPlaceholder": "Search by order name...",
  "table.orderName": "Order Name",
  "table.status": "Status",
  "detail.linkedContract": "Linked Contract",
  "toast.created": "Order created",
  "toast.failed": "Failed to create order"
}
```

## String Inventory

~800+ strings across 35+ files, broken down by namespace:

| Namespace | Approx. Strings | Files |
|-----------|-----------------|-------|
| common | ~150 | StatusBadge, ClickableStatusBadge, SupplierTypeBadge, shared patterns |
| nav | ~25 | Sidebar |
| auth | ~10 | LoginPage |
| dashboard | ~30 | DashboardPage |
| orders | ~80 | OrdersPage, OrderDetailPage, OrderCreatePage, PlanningBoardPage |
| inbounds | ~25 | InboundsPage |
| weighing | ~60 | WeighingEventPage |
| sorting | ~70 | SortingPage, SortingProcessListPage, ContaminationRecordModal |
| contracts | ~100 | ContractsDashboardPage, ContractDetailPage, ContractCreatePage, modals |
| invoices | ~40 | InvoicesPage, InvoiceCreatePage, InvoiceDetailPage |
| admin | ~150 | UsersPage, CarriersPage, SuppliersPage, MaterialsManagementPage, FeeMasterPage, SystemSettingsPage, AuditLogPage |
| reports | ~40 | ReportsPage, SchedulesPage |
| arrival | ~25 | ArrivalPage |
| errors | ~10 | NotFoundPage, UnauthorisedPage |

## What NOT to Translate

- Database values (entity names, codes, labels entered by users)
- Technical identifiers (INB-00001, P-00001, etc.)
- API error messages from backend (shown via toast, keep English)
- Enum values in code (PLANNED, ARRIVED — only their display labels)
- Logo text ("Evreka360")
- Email addresses, URLs

## Migration Strategy

Per-file approach:
1. Create JSON translation files with all keys (en first, then nl)
2. Update each page/component to use `useTranslation()` + `t()` calls
3. Replace hardcoded strings with `t('namespace:key')`
4. Remove old constant label objects (ROLE_LABELS, STATUS_CONFIG labels, etc.) — move to common.json

## Dependencies

```bash
npm install react-i18next i18next i18next-browser-languagedetector
```
