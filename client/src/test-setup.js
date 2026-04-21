import '@testing-library/jest-dom';

const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;
const originalConsoleLog = console.log;

const IGNORED_MESSAGES = [
  'React Router Future Flag Warning',
  'not wrapped in act',
  'i18next is made possible',
  '--localstorage-file',
];

function shouldIgnoreMessage(args) {
  return args.some((arg) => {
    if (typeof arg !== 'string') return false;
    return IGNORED_MESSAGES.some((message) => arg.includes(message));
  });
}

console.warn = (...args) => {
  if (shouldIgnoreMessage(args)) return;
  originalConsoleWarn(...args);
};

console.error = (...args) => {
  if (shouldIgnoreMessage(args)) return;
  originalConsoleError(...args);
};

console.log = (...args) => {
  if (shouldIgnoreMessage(args)) return;
  originalConsoleLog(...args);
};

if (typeof process !== 'undefined' && process.on) {
  process.on('warning', (warning) => {
    if (shouldIgnoreMessage([warning?.message || '', warning?.name || ''])) return;
    originalConsoleWarn(warning);
  });
}

await import('./i18n');
