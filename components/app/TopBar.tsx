"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wallet } from "lucide-react";
import PartySwitcher from "@/components/PartySwitcher";
import MoneyValue from "@/components/ui/MoneyValue";
import { getBalanceLive } from "@/lib/ledger";
import { useNetChain } from "@/lib/store";

export default function TopBar() {
  const currentPartyId = useNetChain((s) => s.currentPartyId);
  const balance = useNetChain((s) => s.balances[currentPartyId]);
  const isLive = process.env.NEXT_PUBLIC_LEDGER_LIVE === "1";

  const [liveBalance, setLiveBalance] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    getBalanceLive(currentPartyId).then((b) => live && b !== null && setLiveBalance(b));
    return () => { live = false; };
  }, [currentPartyId]);

  return (
    <header className="flex items-center justify-between gap-3 border-b border-frost/10 px-4 py-3 md:px-6">
      <Link
        href="/"
        className="text-base font-bold tracking-[-0.02em] text-frost"
      >
        Net<span className="text-accent">Chain</span>
        <span className="ml-2 hidden rounded-full border border-frost/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-frost/50 sm:inline">
          Demo
        </span>
        <span
          className={`ml-2 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest ${
            isLive
              ? "border-accent/40 text-accent"
              : "border-frost/20 text-frost/50"
          }`}
          title={isLive ? "Data source: live ledger" : "Data source: mock"}
          aria-label={isLive ? "Data source: live ledger" : "Data source: mock"}
        >
          {isLive ? "LIVE" : "MOCK"}
        </span>
      </Link>

      <div className="flex items-center gap-3">
        <div
          className="hidden items-center gap-2 rounded-full border border-frost/15 px-4 py-2 md:flex"
          aria-label="USDCx balance"
        >
          <Wallet size={14} className="text-frost/50" aria-hidden="true" />
          <MoneyValue amount={liveBalance ?? balance} className="text-sm" />
        </div>
        <PartySwitcher compact />
      </div>
    </header>
  );
}
