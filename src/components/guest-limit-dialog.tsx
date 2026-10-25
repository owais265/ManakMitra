import { Link } from "@tanstack/react-router";
import ManakMark from "@/components/manak-mark";

export default function GuestLimitDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/55 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="mm-guest-limit-title" className="w-full max-w-sm rounded-2xl bg-white p-6 text-slate-900 shadow-2xl dark:bg-[#111] dark:text-white">
        <div className="flex flex-col items-center text-center">
          <ManakMark className="h-12 w-12" />
          <h2 id="mm-guest-limit-title" className="mt-4 text-xl font-semibold">Log in or sign up</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            This guest has used 20 questions. Only this guest is locked. Log in for unlimited questions.
          </p>
        </div>
        <Link
          to="/login"
          className="mt-5 flex w-full items-center justify-center rounded-full bg-slate-900 px-4 py-3 text-sm font-medium text-white dark:bg-white dark:text-slate-900"
        >
          Login
        </Link>
        <button type="button" onClick={onClose} className="mt-2 w-full py-2 text-sm text-slate-500">
          Close
        </button>
      </div>
    </div>
  );
}
