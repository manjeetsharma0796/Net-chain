"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { GitMerge } from "lucide-react";
import NumberTicker from "@/components/ui/NumberTicker";
import { partyById } from "@/lib/store";
import type { Obligation, PartyId } from "@/lib/types";

/**
 * Fixed triangle layout, NetChain is always exactly 3 counterparties
 * (PartyId is a 3-way literal union), so the graph geometry is static.
 */
const VB_W = 460;
const VB_H = 340;
const RADIUS = 30;
const BOW = 34;

const NODES: Record<PartyId, { x: number; y: number }> = {
  "company-a": { x: 230, y: 74 },
  "company-b": { x: 86, y: 268 },
  "company-c": { x: 374, y: 268 },
};
const PARTY_IDS = Object.keys(NODES) as PartyId[];

const CENTROID = {
  x: Object.values(NODES).reduce((s, p) => s + p.x, 0) / PARTY_IDS.length,
  y: Object.values(NODES).reduce((s, p) => s + p.y, 0) / PARTY_IDS.length,
};

/** All 6 possible directed pairs among 3 parties. */
const PAIRS: [PartyId, PartyId][] = [
  ["company-a", "company-b"],
  ["company-b", "company-a"],
  ["company-b", "company-c"],
  ["company-c", "company-b"],
  ["company-c", "company-a"],
  ["company-a", "company-c"],
];

function unit(dx: number, dy: number) {
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

interface Edge {
  from: PartyId;
  to: PartyId;
  amount: number;
  path: string;
  labelX: number;
  labelY: number;
}

/** Sum obligations per directed pair, so repeat invoices between the
 * same two parties collapse into one labelled edge. */
function buildEdges(obligations: Obligation[]): Edge[] {
  const sums = new Map<string, number>();
  for (const o of obligations) {
    const key = `${o.obligor}->${o.obligee}`;
    sums.set(key, (sums.get(key) ?? 0) + o.amount);
  }
  const edges: Edge[] = [];
  for (const [from, to] of PAIRS) {
    const amount = sums.get(`${from}->${to}`) ?? 0;
    if (amount <= 0) continue;
    const a = NODES[from];
    const b = NODES[to];
    const dir = unit(b.x - a.x, b.y - a.y);
    const start = { x: a.x + dir.x * (RADIUS + 2), y: a.y + dir.y * (RADIUS + 2) };
    const end = { x: b.x - dir.x * (RADIUS + 10), y: b.y - dir.y * (RADIUS + 10) };
    const normal = { x: -dir.y, y: dir.x };
    const bow = from < to ? BOW : -BOW;
    const cp = {
      x: (start.x + end.x) / 2 + normal.x * bow,
      y: (start.y + end.y) / 2 + normal.y * bow,
    };
    edges.push({
      from,
      to,
      amount,
      path: `M ${start.x} ${start.y} Q ${cp.x} ${cp.y} ${end.x} ${end.y}`,
      labelX: 0.25 * start.x + 0.5 * cp.x + 0.25 * end.x,
      labelY: 0.25 * start.y + 0.5 * cp.y + 0.25 * end.y,
    });
  }
  return edges;
}

function buildNets(obligations: Obligation[]): Record<PartyId, number> {
  const nets = { "company-a": 0, "company-b": 0, "company-c": 0 } as Record<PartyId, number>;
  for (const o of obligations) {
    nets[o.obligor] -= o.amount;
    nets[o.obligee] += o.amount;
  }
  return nets;
}

interface NettingGraphProps {
  /** In-scope obligations to visualize, gross edges are derived from these. */
  obligations: Obligation[];
  className?: string;
}

/**
 * The hero visual: the 3 companies in a triangle, their gross bilateral
 * obligations as curved directed edges, collapsing into (or expanding back
 * from) each party's single net position. Hand-rolled SVG + framer-motion,
 * no charting dependency.
 */
export default function NettingGraph({ obligations, className = "" }: NettingGraphProps) {
  const reduceMotion = useReducedMotion();
  const [mode, setMode] = useState<"gross" | "net">(reduceMotion ? "net" : "gross");
  const userToggled = useRef(false);

  // One auto-play collapse on first view, unless the user already touched
  // the toggle, or reduced motion asked for the static collapsed state.
  useEffect(() => {
    if (reduceMotion || userToggled.current) return;
    const t = setTimeout(() => setMode("net"), 1600);
    return () => clearTimeout(t);
  }, [reduceMotion]);

  const setModeManual = (m: "gross" | "net") => {
    userToggled.current = true;
    setMode(m);
  };

  const edges = buildEdges(obligations);
  const nets = buildNets(obligations);
  const grossTotal = edges.reduce((s, e) => s + e.amount, 0);
  const sumOfNets = PARTY_IDS.reduce((s, p) => s + nets[p], 0);
  const netTotal = PARTY_IDS.reduce((s, p) => s + Math.max(0, nets[p]), 0);
  const compression = grossTotal > 0 ? (100 - (netTotal / grossTotal) * 100).toFixed(1) : "0.0";
  const transition = { duration: reduceMotion ? 0 : 0.55, ease: [0.25, 0.1, 0.25, 1] as const };

  return (
    <section
      aria-label="Netting graph: gross bilateral obligations collapsing into each party's net position"
      className={`glass-card rounded-2xl p-6 ${className}`}
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <GitMerge size={18} className="text-accent" aria-hidden="true" />
          <h2 className="text-sm font-semibold uppercase tracking-widest">
            The netting collapse
          </h2>
        </div>
        <div
          role="group"
          aria-label="Graph state"
          className="flex rounded-full border border-frost/20 p-1"
        >
          {(
            [
              { key: "gross", label: "Gross obligations" },
              { key: "net", label: "Net positions" },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setModeManual(key)}
              aria-pressed={mode === key}
              className={`min-h-[32px] cursor-pointer rounded-full px-3.5 text-xs font-medium uppercase tracking-wider transition-colors ${
                mode === key ? "bg-frost/15 text-frost" : "text-frost/50 hover:text-frost"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="relative mx-auto w-full max-w-xl"
        style={{ aspectRatio: `${VB_W} / ${VB_H}` }}
      >
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <defs>
            <marker
              id="ng-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#7FA6C9" />
            </marker>
          </defs>
          {edges.map((e) => (
            <motion.path
              key={`${e.from}-${e.to}`}
              d={e.path}
              fill="none"
              stroke="#7FA6C9"
              strokeWidth={1.75}
              strokeLinecap="round"
              markerEnd="url(#ng-arrow)"
              initial={false}
              animate={{
                opacity: mode === "gross" ? 0.75 : 0,
                pathLength: mode === "gross" ? 1 : 0,
              }}
              transition={transition}
            />
          ))}
          {PARTY_IDS.map((pid) => {
            const node = NODES[pid];
            const net = nets[pid];
            const ringColor =
              mode === "net"
                ? net > 0
                  ? "#38E1A4"
                  : net < 0
                    ? "#F5C451"
                    : "#D7E2EA"
                : partyById(pid).color;
            return (
              <motion.circle
                key={pid}
                cx={node.x}
                cy={node.y}
                fill="#0C0C0C"
                fillOpacity={0.85}
                strokeWidth={2.5}
                initial={false}
                animate={{ stroke: ringColor, r: mode === "net" ? RADIUS + 3 : RADIUS }}
                transition={transition}
              />
            );
          })}
        </svg>

        {/* HTML overlay (real text, screen-reader readable): edge amounts + party/net labels */}
        {edges.map((e) => (
          <div
            key={`label-${e.from}-${e.to}`}
            className="figures pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-privacy/25 bg-ink/80 px-1.5 py-0.5 text-[10px] text-privacy/90 transition-opacity"
            style={{
              left: `${(e.labelX / VB_W) * 100}%`,
              top: `${(e.labelY / VB_H) * 100}%`,
              opacity: mode === "gross" ? 1 : 0,
              transitionDuration: reduceMotion ? "0ms" : "550ms",
            }}
          >
            {e.amount.toLocaleString("en-US")}
          </div>
        ))}

        {PARTY_IDS.map((pid) => {
          const node = NODES[pid];
          const dir = unit(node.x - CENTROID.x, node.y - CENTROID.y);
          const lx = node.x + dir.x * (RADIUS + 42);
          const ly = node.y + dir.y * (RADIUS + 42);
          const net = nets[pid];
          const party = partyById(pid);
          return (
            <div
              key={`node-label-${pid}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 text-center"
              style={{ left: `${(lx / VB_W) * 100}%`, top: `${(ly / VB_H) * 100}%` }}
            >
              <p className="flex items-center justify-center gap-1.5 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-frost/80">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: party.color }}
                />
                {party.shortName}
              </p>
              {mode === "net" && (
                <>
                  <p
                    className={`mt-1 whitespace-nowrap text-sm ${
                      net > 0 ? "text-settled" : net < 0 ? "text-pending" : "text-frost/60"
                    }`}
                  >
                    <NumberTicker
                      value={Math.abs(net)}
                      decimals={2}
                      prefix={net > 0 ? "+" : net < 0 ? "−" : ""}
                    />
                    <span className="figures ml-1 text-[10px] opacity-60">USDCx</span>
                  </p>
                  <p className="text-[9px] uppercase tracking-wide text-frost/45">
                    {net > 0 ? "receiver" : net < 0 ? "payer" : "flat"}
                  </p>
                </>
              )}
            </div>
          );
        })}
      </div>

      <p className="figures mt-6 text-center text-xs text-frost/55">
        {mode === "gross"
          ? `${edges.length} obligations · gross ${grossTotal.toLocaleString("en-US")} USDCx`
          : `Σ nets = ${sumOfNets.toLocaleString("en-US")} · gross ${grossTotal.toLocaleString(
              "en-US",
            )} → net ${netTotal.toLocaleString("en-US")} USDCx · ${compression}% compression`}
      </p>
    </section>
  );
}
