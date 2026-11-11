'use client';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { themeCookie } from '../lib/theme';
export function ThemeSwitch(){
 const [dark,setDark]=useState(false);
 useEffect(()=>{setDark(document.documentElement.dataset.theme==='dark');},[]);
 function toggle(){const value=!dark;const theme=value?'dark':'light';setDark(value);document.documentElement.dataset.theme=theme;document.cookie=themeCookie(theme);try{localStorage.removeItem('elo-theme');}catch{}}
 return <button type="button" className="theme-switch" role="switch" aria-checked={dark} aria-label="Modo escuro" title={dark?'Ativar tema claro':'Ativar tema escuro'} onClick={toggle}><Sun size={13}/><Moon size={13}/><span className="theme-switch-thumb"/></button>;
}
