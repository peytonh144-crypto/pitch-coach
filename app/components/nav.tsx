"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Field Mode" },
  { href: "/practice", label: "Practice Mode" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <header className="w-full border-b border-zinc-900 bg-zinc-950">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="text-base font-semibold tracking-tight text-zinc-100"
        >
          Pitch Coach
        </Link>
        <nav className="flex items-center gap-1">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={
                  active
                    ? "rounded-md bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-100"
                    : "rounded-md px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-200"
                }
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
