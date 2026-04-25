"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import EarthGlobe from "./EarthGlobe";
import { supabase } from "@/lib/supabase";

const NAV_ITEMS = [
  { href: "/",               icon: "search",         label: "Search" },
  { href: "/plan-day",       icon: "calendar_today", label: "Plan Day" },
  { href: "/travel-history", icon: "history",        label: "Travel History" },
  { href: "/analytics",      icon: "eco",            label: "Analytics" },
  { href: "/leaderboard",    icon: "leaderboard",    label: "Leaderboard" },
];

const EXPANDED_W = 360;
const COLLAPSED_W = 72;

export default function SideNav() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--sidenav-w",
      `${collapsed ? COLLAPSED_W : EXPANDED_W}px`
    );
  }, [collapsed]);

  useEffect(() => {
    document.documentElement.style.setProperty("--sidenav-w", `${EXPANDED_W}px`);
  }, []);

  return (
    <nav
      style={{ width: collapsed ? COLLAPSED_W : EXPANDED_W }}
      className={`hidden lg:flex flex-col h-screen pt-6 pb-6 fixed left-0 top-0 border-r border-outline-variant bg-surface-container-lowest z-40 overflow-y-auto transition-all duration-300 ${
        collapsed ? "px-2" : "px-4"
      }`}
    >
      {/* Logo + collapse button */}
      <div className={`flex items-center mb-8 ${collapsed ? "justify-center flex-col gap-2" : "justify-between px-2"}`}>
        {!collapsed && (
          <div className="flex items-center gap-3">
            <EarthGlobe size={44} />
            <div>
              <h1 className="font-headline font-bold text-2xl text-tertiary tracking-tighter">ECOpath</h1>
              <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-widest">Eco Route Intelligence</p>
            </div>
          </div>
        )}
        {collapsed && <EarthGlobe size={32} />}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-variant transition-colors text-on-surface-variant"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <span className="material-symbols-outlined text-lg">
            {collapsed ? "chevron_right" : "chevron_left"}
          </span>
        </button>
      </div>

      {/* Nav items */}
      <ul className="flex-1 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`flex items-center rounded border-l-[3px] font-semibold text-xs uppercase tracking-widest transition-colors ${
                  collapsed ? "justify-center px-2 py-3 border-transparent" : "gap-4 px-4 py-3"
                } ${
                  active
                    ? "bg-tertiary-container/10 text-tertiary border-tertiary"
                    : "text-on-surface-variant border-transparent hover:bg-surface-variant"
                }`}
              >
                <span className="material-symbols-outlined flex-shrink-0">{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Sign out */}
      <button
        onClick={() => supabase.auth.signOut()}
        title={collapsed ? "Sign Out" : undefined}
        className={`flex items-center rounded border-l-[3px] border-transparent text-on-surface-variant hover:bg-surface-variant transition-colors font-semibold text-xs uppercase tracking-widest mt-4 ${
          collapsed ? "justify-center px-2 py-3" : "gap-4 px-4 py-3"
        }`}
      >
        <span className="material-symbols-outlined flex-shrink-0">logout</span>
        {!collapsed && <span>Sign Out</span>}
      </button>
    </nav>
  );
}
