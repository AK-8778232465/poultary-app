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
    <main className="min-h-screen px-3 py-5">
      <section className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-sm flex-col justify-center">
        <div className="rounded-[1.8rem] border border-white/50 bg-[rgba(255,252,246,0.86)] p-5 shadow-[0_24px_60px_rgba(33,37,23,0.14)] backdrop-blur">
          <span className="inline-flex rounded-full bg-[rgba(24,61,29,0.1)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--primary)]">
            Private App
          </span>
          <h1 className="display-heading mt-4 text-[2.6rem] leading-none text-[var(--primary)]">
            Gaikwad Poultry
          </h1>
          <p className="mt-3 text-[15px] leading-7 text-[rgba(26,33,19,0.72)]">
            Secure mobile dashboard for rate updates, daily orders, shop records,
            and history.
          </p>

          <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-[15px] font-medium text-[rgba(26,33,19,0.76)]">
                Enter PIN
              </span>
              <input
                autoComplete="current-password"
                className="min-h-12 rounded-[1.2rem] px-4 text-[15px]"
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
              <p className="rounded-[1.2rem] border border-[rgba(187,79,67,0.22)] bg-[rgba(187,79,67,0.09)] px-4 py-3 text-[14px] text-[var(--danger)]">
                {error}
              </p>
            ) : null}

            <button
              className="flex min-h-12 w-full items-center justify-center rounded-[1.2rem] bg-[var(--primary)] px-5 text-[15px] font-semibold text-white transition hover:bg-[var(--primary-soft)] disabled:cursor-not-allowed disabled:opacity-60"
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
