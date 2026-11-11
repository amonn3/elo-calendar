import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTheme, themeCookie } from '../lib/theme.ts';
test('only light and dark are accepted as saved themes',()=>{
 assert.equal(parseTheme('dark'),'dark');assert.equal(parseTheme('light'),'light');
 assert.equal(parseTheme('blue'),null);assert.equal(parseTheme(undefined),null);assert.equal(parseTheme(null),null);
});
test('theme cookie is site-wide and lasts one year',()=>{
 assert.equal(themeCookie('dark'),'elo-theme=dark; Path=/; Max-Age=31536000; SameSite=Lax');
});
