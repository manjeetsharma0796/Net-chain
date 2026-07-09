import TopNav from "@/components/landing/TopNav";
import Hero from "@/components/landing/Hero";
import PrimitivesMarquee from "@/components/landing/PrimitivesMarquee";
import About from "@/components/landing/About";
import HowItWorks from "@/components/landing/HowItWorks";
import PrivacyStack from "@/components/landing/PrivacyStack";
import Footer from "@/components/landing/Footer";
import Toaster from "@/components/ui/Toast";

export default function LandingPage() {
  return (
    <main>
      <TopNav />
      <Hero />
      <PrimitivesMarquee />
      <About />
      <HowItWorks />
      <PrivacyStack />
      <Footer />
      <Toaster />
    </main>
  );
}
