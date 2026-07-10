"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Bot,
  Flame,
  Landmark,
  Network,
  RefreshCcw,
  Vote,
  Wallet,
} from "lucide-react";
import PageHeader from "@/components/app/PageHeader";
import FadeIn from "@/components/motion/FadeIn";
import NumberTicker from "@/components/ui/NumberTicker";
import StatusPill from "@/components/ui/StatusPill";
import { getScanSnapshot } from "@/lib/api";
import { getBalanceLive, getScanLive, type ScanLive } from "@/lib/ledger";
import { formatCompact, formatDate, formatTime } from "@/lib/format";
import { partyById, useNetChain } from "@/lib/store";
import { ScanSnapshot } from "@/lib/types";

function StatCard({
  label,
  value,
  Icon,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  Icon: typeof Network;
  hint?: string;
}) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-frost/50">
          {label}
        </p>
        <Icon size={16} className="text-frost/40" aria-hidden="true" />
      </div>
      <div className="figures mt-3 text-2xl font-medium md:text-3xl">
        {value}
      </div>
      {hint && <p className="mt-1 text-xs text-frost/45">{hint}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const currentPartyId = useNetChain((s) => s.currentPartyId);
  const balance = useNetChain((s) => s.balances[currentPartyId]);
  const cycleId = useNetChain((s) => s.cycleId);
  const cycleStatus = useNetChain((s) => s.cycleStatus);
  const obligations = useNetChain((s) => s.obligations);
  const activity = useNetChain((s) => s.activity);
  const party = partyById(currentPartyId);

  const [scan, setScan] = useState<ScanSnapshot | null>(null);
  const [ccLive, setCcLive] = useState<ScanLive | null>(null);
  const [liveBalance, setLiveBalance] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    getScanSnapshot().then((s) => live && setScan(s));
    getScanLive().then((c) => live && c && setCcLive(c));
    return () => { live = false; };
  }, []);

  useEffect(() => {
    let live = true;
    getBalanceLive(currentPartyId).then((b) => live && b !== null && setLiveBalance(b));
    return () => { live = false; };
  }, [currentPartyId]);

  const myObligations = obligations.filter(
    (o) => o.obligor === currentPartyId || o.obligee === currentPartyId,
  );

  const cyclePill =
    cycleStatus === "settled"
      ? ("settled" as const)
      : cycleStatus === "failed"
        ? ("rejected" as const)
        : cycleStatus === "open"
          ? ("open" as const)
          : ("pending" as const);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Dashboard"
        subtitle={`Canton network overview and ${party.name}'s treasury position. CC price live via CoinGecko; network topology via the Scan API (mocked).`}
      />

      {/* network stats */}
      <FadeIn>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Validators"
            Icon={Network}
            value={scan ? <NumberTicker value={scan.validators} /> : "—"}
            hint={scan ? `${scan.superValidators} super validators` : "loading…"}
          />
          <StatCard
            label="Governance"
            Icon={Vote}
            value={
              <span className="text-lg md:text-xl">
                {scan ? scan.governanceState : "—"}
              </span>
            }
          />
          <StatCard
            label="CC → USD"
            Icon={Flame}
            value={
              (ccLive?.ccPriceUsd ?? scan?.ccPriceUsd) != null ? (
                <NumberTicker
                  value={(ccLive?.ccPriceUsd ?? scan?.ccPriceUsd) as number}
                  prefix="$"
                  decimals={4}
                />
              ) : (
                "—"
              )
            }
            hint={
              ccLive?.ccMarketCapUsd != null
                ? `$${formatCompact(ccLive.ccMarketCapUsd)} market cap · live`
                : scan
                  ? `${formatCompact(scan.totalAmuletBurnt)} CC burnt`
                  : undefined
            }
          />
          <StatCard
            label="Rounds / day"
            Icon={RefreshCcw}
            value={scan ? <NumberTicker value={scan.roundsPerDay} /> : "—"}
          />
        </div>
      </FadeIn>

      {/* treasury row */}
      <FadeIn delay={0.1}>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-frost/50">
                USDCx balance
              </p>
              <Wallet size={16} className="text-frost/40" aria-hidden="true" />
            </div>
            <p className="mt-3 text-3xl">
              <NumberTicker value={liveBalance ?? balance} decimals={2} />
              <span className="figures ml-1.5 text-sm opacity-60">USDCx</span>
            </p>
            <p className="mt-1 text-xs text-frost/45">
              {liveBalance !== null ? "Live on-ledger balance" : "Onboarded via Circle xReserve"}
            </p>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-frost/50">
                Current cycle
              </p>
              <Landmark size={16} className="text-frost/40" aria-hidden="true" />
            </div>
            <p className="figures mt-3 text-lg">{cycleId}</p>
            <div className="mt-2">
              <StatusPill status={cyclePill} label={cycleStatus} />
            </div>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-frost/50">
                Your obligations
              </p>
              <Activity size={16} className="text-frost/40" aria-hidden="true" />
            </div>
            <p className="figures mt-3 text-3xl">{myObligations.length}</p>
            <p className="mt-1 text-xs text-frost/45">
              visible to {party.shortName} — other parties&apos; contracts are
              not in your projection
            </p>
          </div>
        </div>
      </FadeIn>

      {/* activity feed */}
      <FadeIn delay={0.2}>
        <section className="mt-10" aria-label="Recent activity">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-frost/60">
            Recent activity
          </h2>
          <ol className="glass-card divide-y divide-frost/5 rounded-2xl">
            {activity.slice(0, 7).map((ev) => (
              <li key={ev.id} className="flex items-start gap-3 px-5 py-4">
                {ev.actor === "agent" ? (
                  <Bot size={16} className="mt-0.5 shrink-0 text-privacy" aria-hidden="true" />
                ) : (
                  <Activity size={16} className="mt-0.5 shrink-0 text-frost/40" aria-hidden="true" />
                )}
                <div className="flex-1">
                  <p className="text-sm text-frost/85">{ev.message}</p>
                  <p className="figures mt-0.5 text-[11px] text-frost/40">
                    {formatDate(ev.at)} · {formatTime(ev.at)} ·{" "}
                    {ev.actor === "agent"
                      ? "treasury agent"
                      : ev.actor === "operator"
                        ? "netting operator"
                        : partyById(ev.actor).shortName}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </FadeIn>
    </div>
  );
}
