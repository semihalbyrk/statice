import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

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
import entitiesEN from './en/entities.json';

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
import entitiesNL from './nl/entities.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: commonEN, nav: navEN, auth: authEN, dashboard: dashboardEN,
        orders: ordersEN, inbounds: inboundsEN, weighing: weighingEN,
        sorting: sortingEN, contracts: contractsEN, invoices: invoicesEN,
        admin: adminEN, reports: reportsEN, arrival: arrivalEN, errors: errorsEN, entities: entitiesEN,
      },
      nl: {
        common: commonNL, nav: navNL, auth: authNL, dashboard: dashboardNL,
        orders: ordersNL, inbounds: inboundsNL, weighing: weighingNL,
        sorting: sortingNL, contracts: contractsNL, invoices: invoicesNL,
        admin: adminNL, reports: reportsNL, arrival: arrivalNL, errors: errorsNL, entities: entitiesNL,
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
