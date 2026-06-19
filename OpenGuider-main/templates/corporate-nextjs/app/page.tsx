import Hero from "@/components/Hero";
import ServiceGrid from "@/components/ServiceGrid";
import StatsRow from "@/components/StatsRow";
import Testimonial from "@/components/Testimonial";
import CtaBand from "@/components/CtaBand";
import LogoCloud from "@/components/LogoCloud";

export default function HomePage() {
  return (
    <>
      <Hero />
      <LogoCloud />
      <ServiceGrid />
      <StatsRow />
      <Testimonial />
      <CtaBand />
    </>
  );
}
