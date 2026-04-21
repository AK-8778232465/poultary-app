"use client";

import { FormEvent, useState, useTransition } from "react";

export default function LoginForm() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    startTransition(async () => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pin }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Unable to unlock the app.");
        return;
      }

      window.location.href = "/";
    });
  };

  return (
    <main className="min-h-screen px-4 py-8">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center">
        <div className="rounded-[2rem] border border-white/50 bg-[rgba(255,252,246,0.86)] p-6 shadow-[0_28px_70px_rgba(33,37,23,0.16)] backdrop-blur">
          <span className="inline-flex rounded-full bg-[rgba(24,61,29,0.1)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--primary)]">
            Private App
          </span>
          <h1 className="display-heading mt-5 text-4xl leading-none text-[var(--primary)]">
            Gaikwad Poultry
          </h1>
          <p className="mt-3 text-sm leading-6 text-[rgba(26,33,19,0.72)]">
            Secure mobile dashboard for rate updates, daily orders, shop records,
            and history.
          </p>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[rgba(26,33,19,0.76)]">
                Enter PIN
              </span>
              <input
                autoComplete="current-password"
                inputMode="numeric"
                maxLength={8}
                name="pin"
                onChange={(event) => setPin(event.target.value)}
                placeholder="4 to 8 digit PIN"
                type="password"
                value={pin}
              />
            </label>

            {error ? (
              <p className="rounded-2xl border border-[rgba(187,79,67,0.22)] bg-[rgba(187,79,67,0.09)] px-4 py-3 text-sm text-[var(--danger)]">
                {error}
              </p>
            ) : null}

            <button
              className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-[var(--primary)] px-5 text-base font-semibold text-white transition hover:bg-[var(--primary-soft)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isPending}
              type="submit"
            >
              {isPending ? "Unlocking..." : "Unlock App"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
