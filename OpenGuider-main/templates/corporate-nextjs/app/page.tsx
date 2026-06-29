import Hero from "@/components/Hero";
import ServiceGrid from "@/components/ServiceGrid";
import StatsRow from "@/components/StatsRow";
import Testimonial from "@/components/Testimonial";
import CtaBand from "@/components/CtaBand";
import LogoCloud from "@/components/LogoCloud";
import FeatureBento from "@/components/FeatureBento";
import TeamStrip from "@/components/TeamStrip";
import { siteData } from "@/lib/site-data";

export default function HomePage() {
  const isModern = siteData.themeId === "modern";
  const isLuxury = siteData.themeId === "luks";

  return (
    <>
      <Hero />
      <LogoCloud />
      {isModern ? <FeatureBento /> : <ServiceGrid />}
      <StatsRow />
      {isLuxury ? <TeamStrip /> : null}
      <Testimonial />
      <CtaBand />
    </>
  );
}
