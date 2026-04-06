'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navItems } from '@/lib/nav';
import MaterialSymbols from '@/components/MaterialSymbols';

export default function AppShell({ title, subtitle, children, actions }) {
  const pathname = usePathname();

  return (
    <div className="shell-grid">
      <aside className="hidden md:flex flex-col h-screen w-64 border-r border-[rgba(227,226,231,0.7)] bg-[var(--background)] p-4 gap-2 sticky top-0">
        <div className="px-4 py-8">
          <h1 className="text-lg font-black tracking-tight">MoneyGuy 2.0</h1>
          <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-[var(--muted)]">Next Eval · Stitch skin</p>
        </div>
        <nav className="flex flex-col gap-1 flex-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                  active ? 'bg-white text-[var(--primary)] shadow-sm' : 'text-[var(--muted)] hover:bg-[var(--surface-muted)]'
                }`}
              >
                <MaterialSymbols className="text-[20px]">{item.icon}</MaterialSymbols>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto p-2">
          <div className="primary-gradient rounded-xl px-5 py-4 text-white shadow-lg shadow-blue-200/60">
            <div className="text-sm font-semibold">Same tools, prettier face</div>
            <div className="mt-1 text-xs text-white/80">Vite app stays intact. This is the parallel eval build on port 3003.</div>
          </div>
        </div>
      </aside>

      <main className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-white/70 bg-white/70 px-6 py-3 backdrop-blur-xl md:px-10">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-black tracking-tight">{title}</h2>
              {subtitle ? <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">{subtitle}</p> : null}
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
          </div>
        </header>
        <div className="px-6 py-8 md:px-10">{children}</div>
      </main>
    </div>
  );
}
