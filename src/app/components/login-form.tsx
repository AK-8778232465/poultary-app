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
    <main className="min-h-screen px-3 py-4">
      <section className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[23rem] flex-col justify-center">
        <div className="rounded-[1.35rem] border border-white/50 bg-[rgba(255,252,246,0.86)] p-4 shadow-[0_18px_42px_rgba(33,37,23,0.12)] backdrop-blur">
          <span className="inline-flex rounded-full bg-[rgba(24,61,29,0.1)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
            Private App
          </span>
          <h1 className="display-heading mt-3 text-[2rem] text-[var(--primary)]">
            Gaikwad Poultry
          </h1>
          <p className="mt-2.5 text-[13px] leading-6 text-[rgba(26,33,19,0.72)]">
            Secure mobile dashboard for rate updates, daily orders, shop records,
            and history.
          </p>

          <form className="mt-6 space-y-3.5" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-[rgba(26,33,19,0.76)]">
                Enter PIN
              </span>
              <input
                autoComplete="current-password"
                className="min-h-10 rounded-[0.95rem] px-3 text-[13px]"
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
              <p className="rounded-[0.95rem] border border-[rgba(187,79,67,0.22)] bg-[rgba(187,79,67,0.09)] px-3 py-2.5 text-[12px] text-[var(--danger)]">
                {error}
              </p>
            ) : null}

            <button
              className="flex min-h-10 w-full items-center justify-center rounded-[0.95rem] bg-[var(--primary)] px-4 text-[13px] font-semibold text-white transition hover:bg-[var(--primary-soft)] disabled:cursor-not-allowed disabled:opacity-60"
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
