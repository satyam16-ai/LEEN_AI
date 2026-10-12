import {
  CtaSection,
  FeaturesSection,
  HeroSection,
  HowItWorksSection,
  RolesSection,
} from '@/components/landing';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export function LandingPage() {
  useDocumentTitle();

  return (
    <>
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <RolesSection />
      <CtaSection />
    </>
  );
}
