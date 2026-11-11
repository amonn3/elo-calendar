import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { THEME_COOKIE, THEME_MAX_AGE, parseTheme } from '../lib/theme';
import './globals.css';
export const metadata: Metadata = { title: 'elo — Seu tempo, em um só lugar', description: 'Todas as suas agendas. Uma visão mais leve do seu dia.', icons: { icon: '/favicon.svg' } };
// Without a saved cookie, follow the system preference. A choice saved by older versions in localStorage is migrated to the cookie.
const systemTheme=`(function(){var d=document.documentElement;try{var t=localStorage.getItem('elo-theme');if(t==='dark'||t==='light'){document.cookie='${THEME_COOKIE}='+t+'; Path=/; Max-Age=${THEME_MAX_AGE}; SameSite=Lax';localStorage.removeItem('elo-theme');}else{t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}d.dataset.theme=t;}catch(e){d.dataset.theme='light';}})();`;
export default async function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
 const theme=parseTheme((await cookies()).get(THEME_COOKIE)?.value);
 return <html lang="pt-BR" data-theme={theme??undefined} suppressHydrationWarning><head>{!theme&&<script dangerouslySetInnerHTML={{__html: systemTheme}}/>}</head><body>{children}</body></html>;
}
