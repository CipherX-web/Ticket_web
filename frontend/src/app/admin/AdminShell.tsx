"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  type StaffUser,
  fetchAllPayments,
  fetchStaffMe,
  staffLogin,
  staffLogout,
} from "@/lib/admin-api";
import { Button } from "@/components/Button";
import { TextField } from "@/components/Field";

interface AdminContextValue {
  user: StaffUser;
  pendingPayments: number;
  refreshBadge: () => Promise<void>;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function useAdminContext() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdminContext must be used inside AdminShell");
  return ctx;
}

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", exact: true, icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { href: "/admin/events", label: "Events", exact: false, icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { href: "/admin/categories", label: "Ticket Categories", exact: false, icon: "M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" },
  { href: "/admin/bookings", label: "Bookings", exact: false, icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
  { href: "/admin/attendees", label: "Attendees", exact: false, icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
  { href: "/admin/payments", label: "Payments", exact: false, icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" },
  { href: "/admin/reports", label: "Reports", exact: false, icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { href: "/admin/settings", label: "Settings", exact: false, icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
];

const PAGE_TITLES: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/events": "Events",
  "/admin/categories": "Ticket Categories",
  "/admin/bookings": "Bookings",
  "/admin/attendees": "Attendees",
  "/admin/payments": "Payments",
  "/admin/reports": "Reports & Analytics",
  "/admin/settings": "Settings & Organizers",
};

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<StaffUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingPayments, setPendingPayments] = useState(0);
  const [globalSearch, setGlobalSearch] = useState("");

  // Login form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  async function refreshBadge() {
    try {
      const res = await fetchAllPayments();
      setPendingPayments(res.items.filter((p) => p.status === "MANUAL_REVIEW").length);
    } catch {
      // Ignore if role does not have payment read access
    }
  }

  useEffect(() => {
    fetchStaffMe()
      .then((res) => {
        setUser(res.user);
        void refreshBadge();
      })
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginErr("");
    setLoggingIn(true);
    try {
      const res = await staffLogin({ email, password });
      setUser(res.user);
      void refreshBadge();
    } catch (err) {
      setLoginErr(err instanceof Error ? err.message : "Invalid credentials.");
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleLogout() {
    await staffLogout();
    setUser(null);
  }

  function handleGlobalSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!globalSearch.trim()) return;
    router.push(`/admin/bookings?q=${encodeURIComponent(globalSearch.trim())}`);
    setGlobalSearch("");
  }

  if (checking) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-ivory text-muted">
        <div className="text-sm">Loading Print X Admin Portal…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-ivory p-4">
        <div className="w-full max-w-md rounded-sm border border-line bg-paper p-8 shadow-sm space-y-6">
          <div className="border-b border-line pb-4">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">Print X Staff</span>
            <h1 className="mt-1 font-display text-2xl text-forest">Admin Portal Sign In</h1>
            <p className="mt-1 text-sm text-muted">Authorized personnel only. Sessions are audited.</p>
          </div>

          {loginErr && (
            <p role="alert" className="rounded-sm border border-red-200 bg-red-50 p-3 text-sm text-danger">
              {loginErr}
            </p>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <TextField
              label="Staff Email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail((e.target as HTMLInputElement).value)}
              required
            />
            <TextField
              label="Password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword((e.target as HTMLInputElement).value)}
              required
            />
            <Button type="submit" disabled={loggingIn} className="w-full">
              {loggingIn ? "Signing in…" : "Sign In to Admin"}
            </Button>
          </form>

          <div className="border-t border-line pt-4 text-center">
            <Link href="/events" className="text-xs text-muted underline hover:text-forest">
              ← Return to Public Events Site
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const pageTitle = PAGE_TITLES[pathname] ?? "Admin";

  return (
    <AdminContext.Provider value={{ user, pendingPayments, refreshBadge }}>
      <div className="fixed inset-0 z-40 flex bg-ivory text-ink">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Dedicated Dark Studio Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-studio text-white transition-transform lg:static lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
        >
          <div className="flex h-16 items-center justify-between border-b border-studio-line px-5">
            <Link href="/admin" className="flex items-center gap-2.5 font-display text-lg tracking-[0.18em] text-white">
              <span className="inline-block h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
              <span>PRINT <span className="text-gold">X</span></span>
              <span className="ml-1 rounded-sm border border-studio-line bg-studio-panel px-1.5 py-0.5 font-sans text-[9px] uppercase tracking-widest text-white/70">
                Admin
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="text-white/60 hover:text-white lg:hidden"
              aria-label="Close sidebar"
            >
              ✕
            </button>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Admin navigation">
            {NAV_ITEMS.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm tracking-wide transition-colors ${
                    active
                      ? "border-l-2 border-accent bg-studio-panel font-medium text-white"
                      : "text-white/70 hover:bg-studio-panel/60 hover:text-white"
                  }`}
                >
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                  <span className="flex-1">{item.label}</span>
                  {item.href === "/admin/payments" && pendingPayments > 0 && (
                    <span className="rounded-full bg-gold px-1.5 py-0.5 text-[10px] font-bold text-forest">
                      {pendingPayments}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Admin Profile & Logout */}
          <div className="border-t border-studio-line p-4 space-y-3">
            <div className="rounded-sm bg-studio-panel p-3">
              <p className="truncate text-xs font-semibold text-white">{user.name}</p>
              <p className="truncate text-[11px] text-white/60">{user.email}</p>
              <span className="mt-1.5 inline-block rounded-sm bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-gold">
                {user.role}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-xs">
              <Link
                href="/events"
                target="_blank"
                className="text-white/60 hover:text-white underline"
              >
                Public Site ↗
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-sm border border-studio-line px-2.5 py-1 text-white/80 hover:border-danger hover:text-red-300"
              >
                Sign Out
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content Column */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top Navigation Bar */}
          <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-line bg-paper px-4 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="rounded-sm border border-line p-2 text-forest hover:bg-sage-soft lg:hidden"
                aria-label="Open menu"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted">
                  Admin {pathname !== "/admin" ? `/ ${ pageTitle }` : "/ Overview"}
                </p>
                <h1 className="font-display text-lg font-semibold text-forest leading-tight">{pageTitle}</h1>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <form onSubmit={handleGlobalSearch} className="hidden md:block">
                <input
                  type="search"
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  placeholder="Search booking ref or email…"
                  className="w-60 rounded-sm border border-line bg-ivory px-3 py-1.5 text-xs focus:border-accent focus:outline-none"
                />
              </form>

              <Link
                href="/admin/payments?filter=MANUAL_REVIEW"
                className="relative rounded-sm border border-line p-2 text-muted hover:bg-sage-soft hover:text-forest"
                title="Pending bank reconciliations"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {pendingPayments > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">
                    {pendingPayments}
                  </span>
                )}
              </Link>

              <Link
                href="/admin/events?new=1"
                className="rounded-sm bg-accent px-3.5 py-2 text-xs font-medium text-white hover:bg-accent-deep transition-colors whitespace-nowrap"
              >
                + New Event
              </Link>
            </div>
          </header>

          {/* Scrollable Workspace */}
          <main className="flex-1 overflow-y-auto p-4 lg:p-8">{children}</main>
        </div>
      </div>
    </AdminContext.Provider>
  );
}
