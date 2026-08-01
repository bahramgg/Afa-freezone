import { Features } from "@/components/landing/Features";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingNav } from "@/components/landing/LandingNav";
import { PortalGrid } from "@/components/landing/PortalGrid";
import { Security } from "@/components/landing/Security";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <LandingNav />
      <main className="flex-1">
        <Hero />
        <PortalGrid />
        <HowItWorks />
        <Features />
        <Security />
      </main>
      <LandingFooter />
    </div>
  );
}
