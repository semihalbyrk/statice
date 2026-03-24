# Dutch Translation (i18n) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full English/Dutch language switching to all UI text in the Statice MRF Dashboard.

**Architecture:** react-i18next with JSON namespace files per module. Language selector in sidebar. Each page/component calls `useTranslation()` and replaces hardcoded strings with `t()` calls. Date/number formatting respects active locale.

**Tech Stack:** react-i18next, i18next, i18next-browser-languagedetector

---

## Task 1: Install Dependencies & Create i18n Infrastructure

**Files:**
- Modify: `client/package.json`
- Create: `client/src/i18n/index.js`
- Modify: `client/src/main.jsx` (wrap app with i18n)

- [ ] **Step 1: Install i18n packages**

```bash
cd client && npm install react-i18next i18next i18next-browser-languagedetector
```

- [ ] **Step 2: Create i18n config**

Create `client/src/i18n/index.js`:

```javascript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// English
import commonEN from './en/common.json';
import navEN from './en/nav.json';
import authEN from './en/auth.json';
import dashboardEN from './en/dashboard.json';
import ordersEN from './en/orders.json';
import inboundsEN from './en/inbounds.json';
import weighingEN from './en/weighing.json';
import sortingEN from './en/sorting.json';
import contractsEN from './en/contracts.json';
import invoicesEN from './en/invoices.json';
import adminEN from './en/admin.json';
import reportsEN from './en/reports.json';
import arrivalEN from './en/arrival.json';
import errorsEN from './en/errors.json';

// Dutch
import commonNL from './nl/common.json';
import navNL from './nl/nav.json';
import authNL from './nl/auth.json';
import dashboardNL from './nl/dashboard.json';
import ordersNL from './nl/orders.json';
import inboundsNL from './nl/inbounds.json';
import weighingNL from './nl/weighing.json';
import sortingNL from './nl/sorting.json';
import contractsNL from './nl/contracts.json';
import invoicesNL from './nl/invoices.json';
import adminNL from './nl/admin.json';
import reportsNL from './nl/reports.json';
import arrivalNL from './nl/arrival.json';
import errorsNL from './nl/errors.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: commonEN, nav: navEN, auth: authEN, dashboard: dashboardEN,
        orders: ordersEN, inbounds: inboundsEN, weighing: weighingEN,
        sorting: sortingEN, contracts: contractsEN, invoices: invoicesEN,
        admin: adminEN, reports: reportsEN, arrival: arrivalEN, errors: errorsEN,
      },
      nl: {
        common: commonNL, nav: navNL, auth: authNL, dashboard: dashboardNL,
        orders: ordersNL, inbounds: inboundsNL, weighing: weighingNL,
        sorting: sortingNL, contracts: contractsNL, invoices: invoicesNL,
        admin: adminNL, reports: reportsNL, arrival: arrivalNL, errors: errorsNL,
      },
    },
    fallbackLng: 'en',
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'statice_language',
      caches: ['localStorage'],
    },
  });

export default i18n;
```

- [ ] **Step 3: Import i18n in main.jsx**

In `client/src/main.jsx`, add at the top (before App import):

```javascript
import './i18n';
```

- [ ] **Step 4: Create empty JSON stubs for both languages**

Create all 28 JSON files (14 per language) with empty `{}` so the app doesn't crash:

```
client/src/i18n/en/common.json    → {}
client/src/i18n/en/nav.json       → {}
client/src/i18n/en/auth.json      → {}
client/src/i18n/en/dashboard.json → {}
client/src/i18n/en/orders.json    → {}
client/src/i18n/en/inbounds.json  → {}
client/src/i18n/en/weighing.json  → {}
client/src/i18n/en/sorting.json   → {}
client/src/i18n/en/contracts.json → {}
client/src/i18n/en/invoices.json  → {}
client/src/i18n/en/admin.json     → {}
client/src/i18n/en/reports.json   → {}
client/src/i18n/en/arrival.json   → {}
client/src/i18n/en/errors.json    → {}
```

Same for `nl/` directory — all `{}`.

- [ ] **Step 5: Verify build**

```bash
cd client && npx vite build --mode development
```

- [ ] **Step 6: Commit**

```bash
git add client/package.json client/package-lock.json client/src/i18n/ client/src/main.jsx
git commit -m "feat: add react-i18next infrastructure with empty translation stubs"
```

---

## Task 2: Common Translation File (English + Dutch)

**Files:**
- Create: `client/src/i18n/en/common.json` (overwrite stub)
- Create: `client/src/i18n/nl/common.json` (overwrite stub)

This is the largest translation file. It contains ALL shared strings: buttons, statuses, roles, enums, table patterns, toast messages, confirm dialogs.

- [ ] **Step 1: Write en/common.json**

```json
{
  "buttons": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "create": "Create",
    "close": "Close",
    "confirm": "Confirm",
    "back": "Back",
    "next": "Next",
    "search": "Search",
    "add": "Add",
    "remove": "Remove",
    "update": "Update",
    "submit": "Submit",
    "loading": "Loading...",
    "saving": "Saving...",
    "creating": "Creating...",
    "updating": "Updating...",
    "download": "Download",
    "print": "Print",
    "dismiss": "Dismiss",
    "report": "Report",
    "reset": "Reset",
    "apply": "Apply",
    "retry": "Retry"
  },
  "status": {
    "PLANNED": "Planned",
    "ARRIVED": "Arrived",
    "IN_PROGRESS": "In Progress",
    "COMPLETED": "Completed",
    "CANCELLED": "Cancelled",
    "DISPUTE": "Dispute",
    "INVOICED": "Invoiced",
    "WEIGHED_IN": "Weighed In",
    "WEIGHED_OUT": "Weighed Out",
    "READY_FOR_SORTING": "Ready for Sorting",
    "SORTED": "Sorted",
    "ACTIVE": "Active",
    "INACTIVE": "Inactive",
    "DRAFT": "Draft",
    "EXPIRED": "Expired",
    "NOT_STARTED": "Not Started",
    "FINALIZED": "Finalized",
    "CONFIRMED": "Confirmed",
    "SUPERSEDED": "Superseded"
  },
  "roles": {
    "ADMIN": "Admin",
    "LOGISTICS_PLANNER": "Logistics Planner",
    "GATE_OPERATOR": "Gate Operator",
    "REPORTING_MANAGER": "Reporting Manager",
    "SORTING_EMPLOYEE": "Sorting Employee",
    "COMPLIANCE_OFFICER": "Compliance Officer",
    "LOGISTICS_COORDINATOR": "Logistics Coordinator",
    "FINANCE_MANAGER": "Finance Manager",
    "FINANCE_USER": "Finance User",
    "SALES": "Sales",
    "QC_INSPECTOR": "QC Inspector"
  },
  "containerTypes": {
    "OPEN_TOP": "Open Top",
    "CLOSED_TOP": "Closed Top",
    "GITTERBOX": "Gitterbox",
    "PALLET": "Pallet",
    "OTHER": "Other"
  },
  "supplierTypes": {
    "PRO": "PRO",
    "THIRD_PARTY": "Third Party",
    "PRIVATE_INDIVIDUAL": "Private Individual"
  },
  "pricingModels": {
    "WEIGHT": "Per Weight (kg)",
    "QUANTITY": "Per Quantity",
    "WEIGHT_AND_QUANTITY": "Per Weight and Quantity"
  },
  "rateTypes": {
    "FIXED": "Fixed",
    "PERCENTAGE": "Percentage",
    "PER_KG": "Per kg",
    "PER_HOUR": "Per hour"
  },
  "feeTypes": {
    "CONTAMINATION_SURCHARGE": "Contamination Surcharge",
    "CONTAMINATION_FLAT_FEE": "Contamination Flat Fee",
    "CONTAMINATION_PERCENTAGE": "Contamination Percentage",
    "SORTING_SURCHARGE": "Sorting Surcharge",
    "HAZARDOUS_MATERIAL": "Hazardous Material",
    "REJECTION_FEE": "Rejection Fee"
  },
  "frequencies": {
    "WEEKLY": "Weekly",
    "MONTHLY": "Monthly",
    "QUARTERLY": "Quarterly",
    "ANNUALLY": "Annually"
  },
  "currencies": {
    "EUR": "EUR (€)",
    "USD": "USD ($)",
    "GBP": "GBP (£)"
  },
  "weeeCategories": {
    "CAT_1": "Cat. 1 — Large Household Appliances",
    "CAT_2": "Cat. 2 — Small Household Appliances",
    "CAT_3": "Cat. 3 — IT and Telecommunications Equipment",
    "CAT_4": "Cat. 4 — Consumer Equipment",
    "CAT_5": "Cat. 5 — Lighting Equipment",
    "CAT_6": "Cat. 6 — Electrical and Electronic Tools",
    "CAT_7": "Cat. 7 — Toys, Leisure and Sports Equipment",
    "CAT_8": "Cat. 8 — Medical Devices",
    "CAT_9": "Cat. 9 — Monitoring and Control Instruments",
    "CAT_10": "Cat. 10 — Automatic Dispensers"
  },
  "incidentTypes": {
    "DAMAGE": "Damage",
    "DISPUTE": "Dispute",
    "SPECIAL_HANDLING": "Special Handling",
    "DRIVER_INSTRUCTION": "Driver Instruction"
  },
  "table": {
    "loading": "Loading...",
    "noData": "No data found",
    "totalCount": "{{count}} total",
    "pageOf": "Page {{page}} of {{total}}",
    "perPage": "{{count}} / page",
    "status": "Status"
  },
  "confirm": {
    "areYouSure": "Are you sure?",
    "cannotUndo": "This action cannot be undone.",
    "deleteConfirm": "Are you sure you want to delete this?"
  },
  "toast": {
    "created": "{{entity}} created",
    "updated": "{{entity}} updated",
    "deleted": "{{entity}} deleted",
    "failed": "Failed to {{action}}",
    "statusUpdated": "Status updated to {{status}}"
  },
  "fields": {
    "name": "Name",
    "email": "Email",
    "phone": "Phone",
    "status": "Status",
    "notes": "Notes",
    "optional": "Optional",
    "required": "Required",
    "active": "Active",
    "description": "Description"
  },
  "empty": "—",
  "yes": "Yes",
  "no": "No",
  "all": "All",
  "total": "Total",
  "or": "or"
}
```

- [ ] **Step 2: Write nl/common.json**

```json
{
  "buttons": {
    "save": "Opslaan",
    "cancel": "Annuleren",
    "delete": "Verwijderen",
    "edit": "Bewerken",
    "create": "Aanmaken",
    "close": "Sluiten",
    "confirm": "Bevestigen",
    "back": "Terug",
    "next": "Volgende",
    "search": "Zoeken",
    "add": "Toevoegen",
    "remove": "Verwijderen",
    "update": "Bijwerken",
    "submit": "Indienen",
    "loading": "Laden...",
    "saving": "Opslaan...",
    "creating": "Aanmaken...",
    "updating": "Bijwerken...",
    "download": "Downloaden",
    "print": "Afdrukken",
    "dismiss": "Sluiten",
    "report": "Rapporteren",
    "reset": "Resetten",
    "apply": "Toepassen",
    "retry": "Opnieuw proberen"
  },
  "status": {
    "PLANNED": "Gepland",
    "ARRIVED": "Aangekomen",
    "IN_PROGRESS": "In Behandeling",
    "COMPLETED": "Afgerond",
    "CANCELLED": "Geannuleerd",
    "DISPUTE": "Geschil",
    "INVOICED": "Gefactureerd",
    "WEIGHED_IN": "Ingewogen",
    "WEIGHED_OUT": "Uitgewogen",
    "READY_FOR_SORTING": "Klaar voor Sortering",
    "SORTED": "Gesorteerd",
    "ACTIVE": "Actief",
    "INACTIVE": "Inactief",
    "DRAFT": "Concept",
    "EXPIRED": "Verlopen",
    "NOT_STARTED": "Niet Gestart",
    "FINALIZED": "Definitief",
    "CONFIRMED": "Bevestigd",
    "SUPERSEDED": "Vervangen"
  },
  "roles": {
    "ADMIN": "Beheerder",
    "LOGISTICS_PLANNER": "Logistiek Planner",
    "GATE_OPERATOR": "Poortoperator",
    "REPORTING_MANAGER": "Rapportage Manager",
    "SORTING_EMPLOYEE": "Sorteermedewerker",
    "COMPLIANCE_OFFICER": "Compliance Officer",
    "LOGISTICS_COORDINATOR": "Logistiek Coördinator",
    "FINANCE_MANAGER": "Financieel Manager",
    "FINANCE_USER": "Financieel Gebruiker",
    "SALES": "Verkoop",
    "QC_INSPECTOR": "Kwaliteitscontroleur"
  },
  "containerTypes": {
    "OPEN_TOP": "Open Top",
    "CLOSED_TOP": "Gesloten Top",
    "GITTERBOX": "Gitterbox",
    "PALLET": "Pallet",
    "OTHER": "Overig"
  },
  "supplierTypes": {
    "PRO": "PRO",
    "THIRD_PARTY": "Derde Partij",
    "PRIVATE_INDIVIDUAL": "Particulier"
  },
  "pricingModels": {
    "WEIGHT": "Per Gewicht (kg)",
    "QUANTITY": "Per Aantal",
    "WEIGHT_AND_QUANTITY": "Per Gewicht en Aantal"
  },
  "rateTypes": {
    "FIXED": "Vast",
    "PERCENTAGE": "Percentage",
    "PER_KG": "Per kg",
    "PER_HOUR": "Per uur"
  },
  "feeTypes": {
    "CONTAMINATION_SURCHARGE": "Verontreinigingstoeslag",
    "CONTAMINATION_FLAT_FEE": "Verontreinigingstarief (vast)",
    "CONTAMINATION_PERCENTAGE": "Verontreinigingspercentage",
    "SORTING_SURCHARGE": "Sorteertoeslag",
    "HAZARDOUS_MATERIAL": "Gevaarlijk Materiaal",
    "REJECTION_FEE": "Afkeuringskosten"
  },
  "frequencies": {
    "WEEKLY": "Wekelijks",
    "MONTHLY": "Maandelijks",
    "QUARTERLY": "Per Kwartaal",
    "ANNUALLY": "Jaarlijks"
  },
  "currencies": {
    "EUR": "EUR (€)",
    "USD": "USD ($)",
    "GBP": "GBP (£)"
  },
  "weeeCategories": {
    "CAT_1": "Cat. 1 — Grote Huishoudelijke Apparaten",
    "CAT_2": "Cat. 2 — Kleine Huishoudelijke Apparaten",
    "CAT_3": "Cat. 3 — IT- en Telecommunicatieapparatuur",
    "CAT_4": "Cat. 4 — Consumentenapparatuur",
    "CAT_5": "Cat. 5 — Verlichtingsapparatuur",
    "CAT_6": "Cat. 6 — Elektrisch en Elektronisch Gereedschap",
    "CAT_7": "Cat. 7 — Speelgoed, Vrije Tijd en Sport",
    "CAT_8": "Cat. 8 — Medische Apparaten",
    "CAT_9": "Cat. 9 — Meet- en Controle-instrumenten",
    "CAT_10": "Cat. 10 — Automaten"
  },
  "incidentTypes": {
    "DAMAGE": "Schade",
    "DISPUTE": "Geschil",
    "SPECIAL_HANDLING": "Speciale Behandeling",
    "DRIVER_INSTRUCTION": "Chauffeursinstructie"
  },
  "table": {
    "loading": "Laden...",
    "noData": "Geen gegevens gevonden",
    "totalCount": "{{count}} totaal",
    "pageOf": "Pagina {{page}} van {{total}}",
    "perPage": "{{count}} / pagina",
    "status": "Status"
  },
  "confirm": {
    "areYouSure": "Weet u het zeker?",
    "cannotUndo": "Deze actie kan niet ongedaan worden gemaakt.",
    "deleteConfirm": "Weet u zeker dat u dit wilt verwijderen?"
  },
  "toast": {
    "created": "{{entity}} aangemaakt",
    "updated": "{{entity}} bijgewerkt",
    "deleted": "{{entity}} verwijderd",
    "failed": "Kan {{action}} niet uitvoeren",
    "statusUpdated": "Status bijgewerkt naar {{status}}"
  },
  "fields": {
    "name": "Naam",
    "email": "E-mail",
    "phone": "Telefoon",
    "status": "Status",
    "notes": "Opmerkingen",
    "optional": "Optioneel",
    "required": "Verplicht",
    "active": "Actief",
    "description": "Beschrijving"
  },
  "empty": "—",
  "yes": "Ja",
  "no": "Nee",
  "all": "Alle",
  "total": "Totaal",
  "or": "of"
}
```

- [ ] **Step 3: Verify build**

```bash
cd client && npx vite build --mode development
```

- [ ] **Step 4: Commit**

```bash
git add client/src/i18n/en/common.json client/src/i18n/nl/common.json
git commit -m "feat: add common translation files (EN + NL)"
```

---

## Task 3: Navigation & Language Selector

**Files:**
- Create: `client/src/i18n/en/nav.json`
- Create: `client/src/i18n/nl/nav.json`
- Create: `client/src/components/layout/LanguageSelector.jsx`
- Modify: `client/src/components/layout/Sidebar.jsx`
- Modify: `client/src/components/ui/StatusBadge.jsx`
- Modify: `client/src/components/ui/ClickableStatusBadge.jsx`
- Modify: `client/src/components/ui/SupplierTypeBadge.jsx`

- [ ] **Step 1: Write nav translation files**

`en/nav.json`:
```json
{
  "main": "Main",
  "dashboard": "Dashboard",
  "orders": "Orders",
  "planningBoard": "Planning Board",
  "arrival": "Arrival",
  "inbounds": "Inbounds",
  "process": "Process",
  "reports": "Reports",
  "contracts": "Contracts",
  "invoices": "Invoices",
  "admin": "Admin",
  "users": "Users",
  "carriers": "Carriers",
  "suppliers": "Suppliers",
  "materials": "Materials",
  "feeMaster": "Fee Master",
  "auditLog": "Audit Log",
  "settings": "Settings",
  "logout": "Logout",
  "signedOut": "Signed out",
  "language": "Language"
}
```

`nl/nav.json`:
```json
{
  "main": "Hoofdmenu",
  "dashboard": "Dashboard",
  "orders": "Bestellingen",
  "planningBoard": "Dagplanning",
  "arrival": "Aankomst",
  "inbounds": "Inkomend",
  "process": "Verwerking",
  "reports": "Rapporten",
  "contracts": "Contracten",
  "invoices": "Facturen",
  "admin": "Beheer",
  "users": "Gebruikers",
  "carriers": "Transporteurs",
  "suppliers": "Leveranciers",
  "materials": "Materialen",
  "feeMaster": "Tarieven",
  "auditLog": "Auditlog",
  "settings": "Instellingen",
  "logout": "Uitloggen",
  "signedOut": "Uitgelogd",
  "language": "Taal"
}
```

- [ ] **Step 2: Create LanguageSelector component**

Create `client/src/components/layout/LanguageSelector.jsx`:

```jsx
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'nl', label: 'Nederlands' },
];

export default function LanguageSelector() {
  const { i18n } = useTranslation();

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <Globe size={14} className="text-grey-400 flex-shrink-0" />
      <select
        value={i18n.language?.startsWith('nl') ? 'nl' : 'en'}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
        className="w-full bg-transparent text-sm text-grey-300 border-0 outline-none cursor-pointer hover:text-white transition-colors"
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code} className="bg-grey-800 text-grey-100">
            {lang.label}
          </option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 3: Update Sidebar to use translations + LanguageSelector**

In `client/src/components/layout/Sidebar.jsx`:

1. Add imports: `import { useTranslation } from 'react-i18next';` and `import LanguageSelector from './LanguageSelector';`
2. Inside the component, add `const { t } = useTranslation(['nav', 'common']);`
3. Replace all hardcoded NAV_ITEMS labels with `t('nav:dashboard')`, `t('nav:orders')`, etc.
4. Replace ADMIN_ITEMS labels similarly.
5. Replace ROLE_LABELS with `t('common:roles.ADMIN')`, etc.
6. Replace "Logout" with `t('nav:logout')`
7. Replace "Signed out" toast with `t('nav:signedOut')`
8. Add `<LanguageSelector />` above the user card section at the bottom of the sidebar.

- [ ] **Step 4: Update StatusBadge to use translations**

In `client/src/components/ui/StatusBadge.jsx`:
1. Add `import { useTranslation } from 'react-i18next';`
2. Inside the component, add `const { t } = useTranslation('common');`
3. Replace hardcoded status labels with `t('common:status.${status}')` or keep the STATUS_CONFIG map for colors but use `t()` for labels.

- [ ] **Step 5: Update ClickableStatusBadge to use translations**

Same pattern as StatusBadge — replace TRANSITION_LABELS with `t('common:status.${status}')`.

- [ ] **Step 6: Update SupplierTypeBadge to use translations**

Replace hardcoded type labels with `t('common:supplierTypes.${type}')`.

- [ ] **Step 7: Verify build and test language switching**

```bash
cd client && npx vite build --mode development
```

- [ ] **Step 8: Commit**

```bash
git add client/src/i18n/en/nav.json client/src/i18n/nl/nav.json \
  client/src/components/layout/LanguageSelector.jsx \
  client/src/components/layout/Sidebar.jsx \
  client/src/components/ui/StatusBadge.jsx \
  client/src/components/ui/ClickableStatusBadge.jsx \
  client/src/components/ui/SupplierTypeBadge.jsx
git commit -m "feat: translate sidebar navigation and shared UI badges"
```

---

## Task 4: Auth & Error Pages Translation

**Files:**
- Create: `client/src/i18n/en/auth.json` + `nl/auth.json`
- Create: `client/src/i18n/en/errors.json` + `nl/errors.json`
- Modify: `client/src/pages/auth/LoginPage.jsx`
- Modify: `client/src/pages/errors/NotFoundPage.jsx`
- Modify: `client/src/pages/errors/UnauthorisedPage.jsx`

- [ ] **Step 1: Write auth + errors translation files (EN + NL)**

See spec for all strings. Include: login form labels, placeholders, button text, error messages, 404/403 page text.

- [ ] **Step 2: Update LoginPage.jsx**

Add `useTranslation('auth')`. Replace all hardcoded strings.

- [ ] **Step 3: Update NotFoundPage.jsx and UnauthorisedPage.jsx**

Add `useTranslation('errors')`. Replace all hardcoded strings.

- [ ] **Step 4: Verify and commit**

```bash
cd client && npx vite build --mode development
git add client/src/i18n/en/auth.json client/src/i18n/nl/auth.json \
  client/src/i18n/en/errors.json client/src/i18n/nl/errors.json \
  client/src/pages/auth/LoginPage.jsx client/src/pages/errors/
git commit -m "feat: translate auth and error pages"
```

---

## Task 5: Dashboard Translation

**Files:**
- Create: `client/src/i18n/en/dashboard.json` + `nl/dashboard.json`
- Modify: `client/src/pages/dashboard/DashboardPage.jsx`

- [ ] **Step 1: Write dashboard translation files**

Include: welcome message (`"welcome": "Welcome, {{name}}"`), stat card labels, table headers, section titles, empty states.

- [ ] **Step 2: Update DashboardPage.jsx**

Add `useTranslation(['dashboard', 'common'])`. Replace all hardcoded strings.

- [ ] **Step 3: Verify and commit**

```bash
cd client && npx vite build --mode development
git add client/src/i18n/en/dashboard.json client/src/i18n/nl/dashboard.json \
  client/src/pages/dashboard/DashboardPage.jsx
git commit -m "feat: translate dashboard page"
```

---

## Task 6: Orders Module Translation

**Files:**
- Create: `client/src/i18n/en/orders.json` + `nl/orders.json`
- Modify: `client/src/pages/orders/OrdersPage.jsx`
- Modify: `client/src/pages/orders/OrderDetailPage.jsx`
- Modify: `client/src/pages/orders/OrderCreatePage.jsx`
- Modify: `client/src/pages/orders/PlanningBoardPage.jsx`

- [ ] **Step 1: Write orders translation files**

Include all strings from: OrdersPage (title, tabs, search, table headers, pagination), OrderDetailPage (info fields, inbound section, incident section), OrderCreatePage (form labels, validation, buttons), PlanningBoardPage (title, filters, card labels).

- [ ] **Step 2: Update all 4 order pages**

Each page: add `useTranslation(['orders', 'common'])` and replace all hardcoded strings.

- [ ] **Step 3: Verify and commit**

```bash
cd client && npx vite build --mode development
git add client/src/i18n/en/orders.json client/src/i18n/nl/orders.json \
  client/src/pages/orders/
git commit -m "feat: translate orders module (list, detail, create, planning board)"
```

---

## Task 7: Inbounds Translation

**Files:**
- Create: `client/src/i18n/en/inbounds.json` + `nl/inbounds.json`
- Modify: `client/src/pages/inbounds/InboundsPage.jsx`

- [ ] **Step 1: Write inbounds translation files**

- [ ] **Step 2: Update InboundsPage.jsx**

- [ ] **Step 3: Verify and commit**

```bash
cd client && npx vite build --mode development
git add client/src/i18n/en/inbounds.json client/src/i18n/nl/inbounds.json \
  client/src/pages/inbounds/InboundsPage.jsx
git commit -m "feat: translate inbounds page"
```

---

## Task 8: Weighing Module Translation

**Files:**
- Create: `client/src/i18n/en/weighing.json` + `nl/weighing.json`
- Modify: `client/src/pages/weighing/WeighingEventPage.jsx`

This is the largest single page. ~60 strings: progress steps, info fields, container types, parcels table, buttons, toasts, manual weighing dialog, incident section.

- [ ] **Step 1: Write weighing translation files**

- [ ] **Step 2: Update WeighingEventPage.jsx**

Replace all hardcoded strings across all sub-components in the file (WeighingFlowSection, ParcelRegistrationForm, ParcelsTable, WeighingTimeline, etc.)

- [ ] **Step 3: Verify and commit**

```bash
cd client && npx vite build --mode development
git add client/src/i18n/en/weighing.json client/src/i18n/nl/weighing.json \
  client/src/pages/weighing/WeighingEventPage.jsx
git commit -m "feat: translate weighing event page"
```

---

## Task 9: Sorting Module Translation

**Files:**
- Create: `client/src/i18n/en/sorting.json` + `nl/sorting.json`
- Modify: `client/src/pages/sorting/SortingPage.jsx`
- Modify: `client/src/pages/sorting/SortingProcessListPage.jsx`
- Modify: `client/src/components/sorting/ContaminationRecordModal.jsx`

- [ ] **Step 1: Write sorting translation files**

Include: tabs, section headers, catalogue labels, outcome form, reusable items, history, contamination modal fields.

- [ ] **Step 2: Update SortingPage.jsx, SortingProcessListPage.jsx, ContaminationRecordModal.jsx**

- [ ] **Step 3: Verify and commit**

```bash
cd client && npx vite build --mode development
git add client/src/i18n/en/sorting.json client/src/i18n/nl/sorting.json \
  client/src/pages/sorting/ client/src/components/sorting/
git commit -m "feat: translate sorting module"
```

---

## Task 10: Contracts Module Translation

**Files:**
- Create: `client/src/i18n/en/contracts.json` + `nl/contracts.json`
- Modify: `client/src/pages/contracts/ContractsDashboardPage.jsx`
- Modify: `client/src/pages/contracts/ContractDetailPage.jsx`
- Modify: `client/src/pages/contracts/ContractCreatePage.jsx`
- Modify: `client/src/components/contracts/RateLineFormModal.jsx`
- Modify: `client/src/components/contracts/PenaltySelectModal.jsx`
- Modify: `client/src/components/contracts/ContractFormModal.jsx`

- [ ] **Step 1: Write contracts translation files**

Include: dashboard (RAG cards, filters, table), detail (all info fields, rate lines), create (form labels, processing methods), modals.

- [ ] **Step 2: Update all 6 files**

- [ ] **Step 3: Verify and commit**

```bash
cd client && npx vite build --mode development
git add client/src/i18n/en/contracts.json client/src/i18n/nl/contracts.json \
  client/src/pages/contracts/ client/src/components/contracts/
git commit -m "feat: translate contracts module"
```

---

## Task 11: Invoices Module Translation

**Files:**
- Create: `client/src/i18n/en/invoices.json` + `nl/invoices.json`
- Modify: `client/src/pages/invoices/InvoicesPage.jsx`
- Modify: `client/src/pages/invoices/InvoiceCreatePage.jsx`
- Modify: `client/src/pages/invoices/InvoiceDetailPage.jsx`

- [ ] **Step 1: Write invoices translation files**

- [ ] **Step 2: Update all 3 invoice pages**

- [ ] **Step 3: Verify and commit**

```bash
cd client && npx vite build --mode development
git add client/src/i18n/en/invoices.json client/src/i18n/nl/invoices.json \
  client/src/pages/invoices/
git commit -m "feat: translate invoices module"
```

---

## Task 12: Admin Module Translation

**Files:**
- Create: `client/src/i18n/en/admin.json` + `nl/admin.json`
- Modify: `client/src/pages/admin/UsersPage.jsx`
- Modify: `client/src/pages/admin/CarriersPage.jsx`
- Modify: `client/src/pages/admin/SuppliersPage.jsx`
- Modify: `client/src/pages/admin/MaterialsManagementPage.jsx`
- Modify: `client/src/pages/admin/FeeMasterPage.jsx`
- Modify: `client/src/pages/admin/SystemSettingsPage.jsx`
- Modify: `client/src/pages/admin/AuditLogPage.jsx`

This is the largest task by file count. ~150 strings across 7 pages.

- [ ] **Step 1: Write admin translation files**

Include all strings from all 7 admin pages. Organize with prefixes: `users.`, `carriers.`, `suppliers.`, `materials.`, `fees.`, `settings.`, `audit.`

- [ ] **Step 2: Update all 7 admin pages**

- [ ] **Step 3: Verify and commit**

```bash
cd client && npx vite build --mode development
git add client/src/i18n/en/admin.json client/src/i18n/nl/admin.json \
  client/src/pages/admin/
git commit -m "feat: translate admin module (users, carriers, suppliers, materials, fees, settings, audit)"
```

---

## Task 13: Reports & Arrival Translation

**Files:**
- Create: `client/src/i18n/en/reports.json` + `nl/reports.json`
- Create: `client/src/i18n/en/arrival.json` + `nl/arrival.json`
- Modify: `client/src/pages/reports/ReportsPage.jsx`
- Modify: `client/src/pages/reports/SchedulesPage.jsx`
- Modify: `client/src/pages/arrival/ArrivalPage.jsx`

- [ ] **Step 1: Write reports + arrival translation files**

Reports: report type names, descriptions, form labels. Arrival: page title, instructions, match sections, buttons.

- [ ] **Step 2: Update ReportsPage.jsx, SchedulesPage.jsx, ArrivalPage.jsx**

- [ ] **Step 3: Verify and commit**

```bash
cd client && npx vite build --mode development
git add client/src/i18n/en/reports.json client/src/i18n/nl/reports.json \
  client/src/i18n/en/arrival.json client/src/i18n/nl/arrival.json \
  client/src/pages/reports/ client/src/pages/arrival/
git commit -m "feat: translate reports and arrival pages"
```

---

## Task 14: Date/Number Formatting & Utilities

**Files:**
- Modify: `client/src/utils/formatDate.js`
- Modify: `client/src/utils/printLabel.js`

- [ ] **Step 1: Update formatDate.js for dynamic locale**

```javascript
import i18n from '../i18n';

const LOCALE_MAP = { en: 'en-GB', nl: 'nl-NL' };

function getLocale() {
  const lang = i18n.language?.startsWith('nl') ? 'nl' : 'en';
  return LOCALE_MAP[lang];
}

export function formatDate(value, options = { day: '2-digit', month: 'short', year: 'numeric' }) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(getLocale(), options);
}

export function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString(getLocale(), {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function formatNumber(value) {
  if (value == null) return '—';
  return Number(value).toLocaleString(getLocale());
}
```

- [ ] **Step 2: Update printLabel.js**

Replace hardcoded English labels with i18n translations.

- [ ] **Step 3: Verify and commit**

```bash
cd client && npx vite build --mode development
git add client/src/utils/formatDate.js client/src/utils/printLabel.js
git commit -m "feat: locale-aware date and number formatting"
```

---

## Task Execution Order

Tasks 1-3 are sequential (infrastructure → common → nav/selector). Tasks 4-13 are independent and can run in any order. Task 14 should run last.

```
Task 1 (infra) → Task 2 (common) → Task 3 (nav + selector)
                                          ↓
                              Tasks 4-13 (any order, independent)
                                          ↓
                              Task 14 (formatting utils)
```

**Recommended order for least context needed:**
1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14
