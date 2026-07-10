"use client";

import FadeIn from "@/components/motion/FadeIn";
import AnimatedText from "@/components/motion/AnimatedText";
import Magnet from "@/components/motion/Magnet";
import SettlementCard from "@/components/landing/SettlementCard";
import PrimaryCTAButton from "@/components/ui/PrimaryCTAButton";

const THESIS =
  "Multilateral netting is decades old. NetChain runs it where books stay private, settlement is atomic, and an AI agent does the paperwork, inside a policy it cannot bypass.";

export default function About() {
  return (
    <section className="relative flex min-h-screen items-center px-5 py-32 md:px-10">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 lg:grid-cols-[3fr_2fr] lg:gap-16">
        <div>
          <FadeIn>
            <p className="eyebrow">The thesis</p>
          </FadeIn>
          <FadeIn delay={0.1}>
            <h2 className="brand-heading mt-4 text-[clamp(2.1rem,4.5vw,3.5rem)] font-medium leading-tight tracking-[-0.02em]">
              Old finance, <span className="accent-word">new</span> ledger
            </h2>
          </FadeIn>
          <AnimatedText
            text={THESIS}
            className="mt-8 text-[clamp(1rem,1.6vw,1.25rem)] leading-relaxed text-frost/90"
          />
          <FadeIn delay={0.2} className="mt-10">
            <PrimaryCTAButton href="/app">See it live</PrimaryCTAButton>
          </FadeIn>
        </div>

        {/* the settlement instruction, the product story as a document */}
        <FadeIn delay={0.25} x={24} y={0} className="justify-self-center lg:justify-self-end">
          <Magnet padding={90} strength={16}>
            <SettlementCard />
          </Magnet>
        </FadeIn>
      </div>
    </section>
  );
}
