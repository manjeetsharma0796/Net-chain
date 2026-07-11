import Link from "next/link";
import TopNav from "@/components/landing/TopNav";
import Hero from "@/components/landing/Hero";
import PrimitivesMarquee from "@/components/landing/PrimitivesMarquee";
import About from "@/components/landing/About";
import Proof, { ThesisStrip } from "@/components/landing/Proof";
import HowItWorks from "@/components/landing/HowItWorks";
import PrivacyStack from "@/components/landing/PrivacyStack";
import Footer from "@/components/landing/Footer";
import Toaster from "@/components/ui/Toast";

export default function LandingPage() {
  return (
    <main>
      <TopNav />
      <Hero />
      <div className="border-b border-frost/10 bg-ink px-6 py-4 text-center md:px-10">
        <p className="text-sm text-frost/70">
          Want to test the whole flow as your own company?{" "}
          <Link
            href="/onboard"
            className="font-medium text-accent underline-offset-4 hover:underline"
          >
            Try it yourself
          </Link>
        </p>
      </div>
      <ThesisStrip />
      <PrimitivesMarquee />
      <About />
      <Proof />
      <HowItWorks />
      <PrivacyStack />
      <Footer />
      <Toaster />
    </main>
  );
}
