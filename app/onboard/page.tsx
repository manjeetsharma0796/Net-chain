"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import FadeIn from "@/components/motion/FadeIn";
import PrimaryCTAButton from "@/components/ui/PrimaryCTAButton";
import { useNetChain } from "@/lib/store";

const inputClasses =
  "w-full rounded-xl border border-frost/20 bg-ink px-3.5 py-2.5 text-sm text-frost placeholder:text-frost/30 focus:border-accent focus:outline-none";

/**
 * Self-serve sandbox onboarding. Spins up an isolated, client-side tenant
 * (lib/store.ts initSandbox) so a visitor can drive the full obligation →
 * net → settle flow as their own company, without touching the shared
 * live ledger demo.
 */
export default function OnboardPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [counterpartyA, setCounterpartyA] = useState("Borealis Logistics");
  const [counterpartyB, setCounterpartyB] = useState("Cirrus Components");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const name = companyName.trim();
    const c1 = counterpartyA.trim();
    const c2 = counterpartyB.trim();
    if (!name) return setError("Enter your company name.");
    if (!c1 || !c2) return setError("Both counterparties need a name.");
    setError(null);
    useNetChain.getState().initSandbox({ companyName: name, counterparties: [c1, c2] });
    router.push("/app");
  };

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-ink px-6 py-16">
      <FadeIn className="w-full max-w-md">
        <div className="glass-card rounded-2xl p-8">
          <p className="eyebrow">Sandbox onboarding</p>
          <h1 className="brand-heading mt-3 text-3xl font-medium tracking-[-0.02em]">
            Try NetChain as your own company
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-frost/65">
            This spins up a self-contained sandbox, so you can record obligations, net, and
            settle as your own company. It runs entirely client-side, separate from the live
            on-chain demo.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
            <label className="block text-xs font-medium uppercase tracking-wider text-frost/60">
              Your company name <span aria-hidden="true">*</span>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Acme Treasury"
                className={`mt-1.5 ${inputClasses}`}
                required
                autoFocus
              />
            </label>

            <label className="block text-xs font-medium uppercase tracking-wider text-frost/60">
              Counterparty 1 <span aria-hidden="true">*</span>
              <input
                type="text"
                value={counterpartyA}
                onChange={(e) => setCounterpartyA(e.target.value)}
                className={`mt-1.5 ${inputClasses}`}
                required
              />
            </label>

            <label className="block text-xs font-medium uppercase tracking-wider text-frost/60">
              Counterparty 2 <span aria-hidden="true">*</span>
              <input
                type="text"
                value={counterpartyB}
                onChange={(e) => setCounterpartyB(e.target.value)}
                className={`mt-1.5 ${inputClasses}`}
                required
              />
            </label>

            {error && (
              <p role="alert" className="text-sm text-rejected">
                {error}
              </p>
            )}

            <PrimaryCTAButton type="submit" className="w-full">
              Launch sandbox
              <ArrowRight size={15} aria-hidden="true" />
            </PrimaryCTAButton>
          </form>

          <p className="mt-6 text-center text-xs text-frost/40">
            <Link href="/" className="transition-colors hover:text-frost/70">
              Back to home
            </Link>
          </p>
        </div>
      </FadeIn>
    </main>
  );
}
