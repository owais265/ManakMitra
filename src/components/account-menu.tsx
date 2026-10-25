import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link } from "@tanstack/react-router";
import { signOut } from "@/lib/auth/client";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";
import { useCurrentUserState, type AppUser } from "@/lib/auth/use-current-user";

const subscribe = () => () => {};

export function HeaderAuth({ tall }: { tall: boolean }) {
  const { user, isPending } = useCurrentUserState();
  const box = tall ? "h-9 sm:h-11" : "h-9";
  if (isPending) {
    return <span aria-hidden className={`inline-block w-[4.25rem] animate-pulse rounded border border-line bg-slate-100 dark:border-slate-600 dark:bg-white/10 ${box}`} />;
  }
  if (!user || user.isDevFallback) {
    return (
      <Link
        to="/login"
        className={`inline-flex items-center rounded border border-line px-2.5 text-xs font-medium text-ink hover:bg-paper sm:text-sm dark:border-slate-600 dark:text-slate-100 dark:hover:bg-[#151d30] ${box}`}
      >
        Login
      </Link>
    );
  }
  return <AccountMenu user={user} placement="down" />;
}

export function AccountMenu({ user, placement }: { user: AppUser; placement: "down" | "up" }) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const gate = useSyncExternalStore(subscribe, hasGateSessionMarker, () => false);
  const rootRef = useRef<HTMLDivElement>(null);
  const label = user.displayName ?? user.primaryEmail ?? "Account";

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const avatar = user.profileImageUrl ? (
    <img src={user.profileImageUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
  ) : (
    <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-900 text-sm font-medium text-white dark:bg-white dark:text-slate-900">
      {label.charAt(0).toUpperCase()}
    </span>
  );

  if (gate) return <span className="inline-flex">{avatar}</span>;

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex rounded-full"
      >
        {avatar}
      </button>
      {open ? (
        <div
          role="menu"
          className={`absolute right-0 z-[70] w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-white/10 dark:bg-[#161616] ${
            placement === "up" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          <Link
            to="/login"
            role="menuitem"
            className="block px-3 py-2 text-left text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-white/10"
            onClick={() => setOpen(false)}
          >
            Switch account
          </Link>
          <button
            type="button"
            role="menuitem"
            disabled={signingOut}
            className="block w-full px-3 py-2 text-left text-slate-800 hover:bg-slate-50 disabled:opacity-60 dark:text-slate-100 dark:hover:bg-white/10"
            onClick={() => {
              setSigningOut(true);
              void signOut("/").catch(() => setSigningOut(false));
            }}
          >
            {signingOut ? "Logging out…" : "Log out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
