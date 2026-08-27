import React from 'react';
import GaiaMark from '@/components/brand/GaiaMark';
import LandingHeader from '@/components/landing/LandingHeader';
import Hero from '@/components/landing/Hero';
import DoctrineSection from '@/components/landing/DoctrineSection';
import WorldModelSection from '@/components/landing/WorldModelSection';
import PantheonSection from '@/components/landing/PantheonSection';
import ConvergenceSection from '@/components/landing/ConvergenceSection';
import WhatIfSection from '@/components/landing/WhatIfSection';
import UnknownSection from '@/components/landing/UnknownSection';
import CoupleSection from '@/components/landing/CoupleSection';

export default function Landing() {
  return (
    <div className="bg-background">
      <LandingHeader />
      <Hero />
      <DoctrineSection />
      <WorldModelSection />
      <PantheonSection />
      <ConvergenceSection />
      <WhatIfSection />
      <UnknownSection />
      <CoupleSection />
      <footer className="aime-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <div className="footer-lockup">
              <GaiaMark className="w-6 h-6 text-white" />
              <span>GAÏA — Wedding Universe Engine</span>
            </div>
            <p>
              Votre mariage est un monde. GAÏA en connaît les forces.<br />
              Système d'orchestration causale — par AIME®
            </p>
          </div>
          <div className="footer-version">
            <p>Release</p>
            <span>v1.0 · Août 2026</span>
          </div>
        </div>
      </footer>
    </div>
  );
}