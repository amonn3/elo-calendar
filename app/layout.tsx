import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'elo — Seu tempo, em um só lugar', description: 'Todas as suas agendas. Uma visão mais leve do seu dia.', icons: { icon: '/favicon.svg' } };
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) { return <html lang="pt-BR" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html: `(function(){try{var theme=localStorage.getItem('elo-theme');document.documentElement.dataset.theme=theme==='dark'||(theme!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';}catch{document.documentElement.dataset.theme='light';}})();`}}/></head><body>{children}</body></html>; }
