import { Hero } from '@/components/landing/Hero';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { LiveAgents } from '@/components/landing/LiveAgents';
import { PricingBlock } from '@/components/landing/PricingBlock';
import { TrustStrip } from '@/components/landing/TrustStrip';
import { ArchitectureTeaser } from '@/components/landing/ArchitectureTeaser';
import { Footer } from '@/components/landing/Footer';

export default function MarketingPage() {
  return (
    <div className="relative min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-x-hidden selection:bg-cyan-500 selection:text-slate-950 transition-colors duration-300">
      <Hero />
      <HowItWorks />
      <LiveAgents />
      <PricingBlock />
      <TrustStrip />
      <ArchitectureTeaser />
      <Footer />
    </div>
  );
}
