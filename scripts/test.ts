// Run tests in-process so the same checks also work in environments that restrict child-process I/O.
await import('../test/auth.test.ts');
await import('../test/calendar.test.ts');
await import('../test/calendar-sync.test.ts');
await import('../test/oauth.test.ts');
await import('../test/report-parser.test.ts');
await import('../test/theme.test.ts');
if(process.argv.includes('--browser'))await import('../test/e2e.browser.ts');
export {};
