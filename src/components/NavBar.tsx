"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/gerador", label: "Gerador" },
  { href: "/history", label: "Histórico" },
  { href: "/config", label: "Config" },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-10 bg-noir-950/90 backdrop-blur border-b border-noir-800">
      <div className="max-w-6xl mx-auto px-4 flex items-center gap-3 h-16">
        <Link href="/" className="flex items-center gap-2 mr-2">
          <span className="w-8 h-8 rounded-full bg-volt text-volt-ink flex items-center justify-center font-black text-lg leading-none">
            ✳
          </span>
          <span className="font-semibold text-zinc-100 hidden sm:block">
            Lotofácil
          </span>
        </Link>

        <div className="flex items-center gap-1.5">
          {LINKS.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${
                  active
                    ? "border-volt/70 bg-noir-800 text-volt font-medium"
                    : "border-noir-600 bg-noir-900 text-zinc-400 hover:text-zinc-200 hover:border-noir-500"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/config"
            aria-label="Configurações"
            className="w-9 h-9 rounded-full border border-noir-600 bg-noir-900 flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:border-noir-500"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </Link>
          <span className="w-9 h-9 rounded-full bg-volt flex items-center justify-center text-volt-ink">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
            </svg>
          </span>
        </div>
      </div>
    </nav>
  );
}
