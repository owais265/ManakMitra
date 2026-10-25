import { AccountMenu } from "@/components/account-menu";
import type { AppUser } from "@/lib/auth/use-current-user";

export type HistoryItem = {
  id: string;
  title: string;
};

export default function HistoryRail({
  threads,
  activeId,
  onOpen,
  onNew,
  user,
  onNavigate,
}: {
  threads: HistoryItem[];
  activeId: string;
  onOpen: (id: string) => void;
  onNew: () => void;
  user: AppUser | null;
  onNavigate?: () => void;
}) {
  return (
    <aside className="flex h-full w-[17rem] shrink-0 flex-col border-r border-slate-200 bg-slate-50 text-slate-800 dark:border-white/10 dark:bg-[#070b14] dark:text-slate-100">
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <p className="text-xs font-medium tracking-wide text-slate-500">History</p>
        <button
          type="button"
          onClick={() => {
            onNew();
            onNavigate?.();
          }}
          className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-200/80 dark:hover:bg-white/10"
        >
          New
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {threads.length === 0 ? (
          <p className="px-2 py-3 text-xs text-slate-400">No chats yet.</p>
        ) : (
          <ul className="space-y-0.5">
            {threads.map((thread) => (
              <li key={thread.id}>
                <button
                  type="button"
                  onClick={() => {
                    onOpen(thread.id);
                    onNavigate?.();
                  }}
                  className={`block w-full truncate rounded-lg px-2.5 py-2 text-left text-sm ${
                    thread.id === activeId
                      ? "bg-slate-200/90 font-medium dark:bg-white/10"
                      : "hover:bg-slate-200/70 dark:hover:bg-white/5"
                  }`}
                >
                  {thread.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex items-center justify-end border-t border-slate-200 px-3 py-3 dark:border-white/10">
        {user && !user.isDevFallback ? <AccountMenu user={user} placement="up" /> : null}
      </div>
    </aside>
  );
}
