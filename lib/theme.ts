export type Theme='light'|'dark';
export const THEME_COOKIE='elo-theme';
export const THEME_MAX_AGE=60*60*24*365;
export function parseTheme(value:string|null|undefined):Theme|null{return value==='dark'||value==='light'?value:null;}
export function themeCookie(theme:Theme){return `${THEME_COOKIE}=${theme}; Path=/; Max-Age=${THEME_MAX_AGE}; SameSite=Lax`;}
