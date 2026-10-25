import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import ManakMark from "@/components/manak-mark";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";

export const Route = createFileRoute("/login")({ component: Login });

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.7-6.6 7.1l.1.1 6.3 5.3C36.9 41.3 44 36 44 24c0-1.3-.1-2.7-.4-3.5z" />
    </svg>
  );
}

function XMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="currentColor" d="M18.24 2H21l-6.52 7.45L22 22h-6.83l-4.72-6.95L5.4 22H2.62l6.97-7.97L2 2h7l4.26 6.34L18.24 2zm-1.2 18h1.86L7.05 3.9H5.07L17.04 20z" />
    </svg>
  );
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"email" | "password">("email");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function continueEmail() {
    setError("");
    if (step === "email") {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
        setError("Enter an email address.");
        return;
      }
      setStep("password");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      const signedIn = await authClient.signIn.email({
        email: email.trim(),
        password,
        callbackURL: "/chat",
      });
      if (!signedIn.error) {
        window.location.assign("/chat");
        return;
      }
      const created = await authClient.signUp.email({
        email: email.trim(),
        password,
        name: email.trim().split("@")[0] || "ManakMitra",
        callbackURL: "/chat",
      });
      if (created.error) {
        setError(signedIn.error.message || created.error.message || "Could not continue.");
        return;
      }
      window.location.assign("/chat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not continue.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-white px-4 py-10 text-slate-900 dark:bg-black dark:text-white">
      <div className="w-full max-w-[24rem]">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <ManakMark className="h-12 w-12" />
          <h1 className="text-[1.7rem] font-semibold tracking-tight">Log in or sign up</h1>
        </div>
        {authEnabled ? (
          <div className="space-y-3">
            {GROK_PROVIDERS.map((provider) => (
              <button
                key={provider.providerId}
                type="button"
                onClick={() => {
                  setError("");
                  void signIn(provider.providerId, { callbackURL: "/chat" }).catch((err: unknown) => {
                    setError(err instanceof Error ? err.message : "Sign-in failed.");
                  });
                }}
                className="flex w-full items-center justify-center gap-3 rounded-full border border-slate-300 px-4 py-3 text-sm font-medium hover:bg-slate-50 dark:border-white/15 dark:hover:bg-white/5"
              >
                {provider.providerId === "grok-google" ? <GoogleMark /> : <XMark />}
                Continue with {provider.label}
              </button>
            ))}
            <div className="flex items-center gap-3 py-1 text-xs text-slate-400">
              <span className="h-px flex-1 bg-slate-200 dark:bg-white/15" />
              OR
              <span className="h-px flex-1 bg-slate-200 dark:bg-white/15" />
            </div>
            {step === "password" ? (
              <button
                type="button"
                className="text-sm text-slate-500 underline-offset-4 hover:underline"
                onClick={() => {
                  setStep("email");
                  setPassword("");
                  setError("");
                }}
              >
                {email}
              </button>
            ) : null}
            {step === "email" ? (
              <input
                type="email"
                autoComplete="email"
                placeholder="Email address"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void continueEmail();
                }}
                className="w-full rounded-full border border-slate-300 bg-transparent px-4 py-3 text-sm outline-none focus:border-slate-500 dark:border-white/15"
              />
            ) : (
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void continueEmail();
                }}
                className="w-full rounded-full border border-slate-300 bg-transparent px-4 py-3 text-sm outline-none focus:border-slate-500 dark:border-white/15"
              />
            )}
            {error ? <p className="text-center text-sm text-red-600 dark:text-red-400">{error}</p> : null}
            <button
              type="button"
              disabled={busy}
              onClick={() => void continueEmail()}
              className="w-full rounded-full bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-slate-900"
            >
              {busy ? "Please wait…" : "Continue"}
            </button>
          </div>
        ) : (
          <p className="text-center text-sm text-slate-500">Sign-in is disabled.</p>
        )}
        <p className="mt-8 text-center text-xs text-slate-500">
          <Link to="/terms" className="underline underline-offset-4">Terms</Link>
          <span className="px-2">|</span>
          <Link to="/privacy" className="underline underline-offset-4">Privacy</Link>
        </p>
      </div>
    </main>
  );
}
