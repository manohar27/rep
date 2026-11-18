import type { SVGProps } from 'react'
const base = (p: SVGProps<SVGSVGElement>) => ({ width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, ...p })
export const Plus = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>
export const Check = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)} strokeWidth={3}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
export const X = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M6 6l12 12M18 6L6 18" /></svg>
export const Dots = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /></svg>
export const Search = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)} width={18} height={18}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
export const Down = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M6 9l6 6 6-6" /></svg>
export const Up = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M18 15l-6-6-6 6" /></svg>
export const Trash = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)} width={18} height={18}><path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12M9 7V4h6v3" /></svg>
export const Bookmark = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)} width={18} height={18}><path d="M6 4h12v17l-6-4-6 4z" /></svg>
export const Play = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)} fill="currentColor" stroke="none"><path d="M8 5.5v13a1 1 0 001.5.86l10.5-6.5a1 1 0 000-1.72L9.5 4.64A1 1 0 008 5.5z" /></svg>
export const Dumbbell = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M3 10v4M6 7v10M18 7v10M21 10v4M6 12h12" /></svg>
export const Timer = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)} width={18} height={18}><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2M9 2h6" /></svg>
export const Trophy = (p: SVGProps<SVGSVGElement>) => <svg {...base({ width: 14, height: 14, ...p })}><path d="M8 4h8v5a4 4 0 01-8 0V4zM8 6H5a3 3 0 003 4M16 6h3a3 3 0 01-3 4M12 13v4M8.5 20h7M10 17h4" /></svg>
export const Lock = (p: SVGProps<SVGSVGElement>) => <svg {...base({ width: 20, height: 20, ...p })}><rect x="5" y="11" width="14" height="10" rx="2.5" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>
export const Backspace = (p: SVGProps<SVGSVGElement>) => <svg {...base({ width: 26, height: 26, strokeWidth: 2, ...p })}><path d="M21 5H9l-6 7 6 7h12a1 1 0 001-1V6a1 1 0 00-1-1zM17 9l-5 6M12 9l5 6" /></svg>
