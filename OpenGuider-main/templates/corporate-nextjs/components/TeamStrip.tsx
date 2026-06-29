import { siteData } from "@/lib/site-data";

const TEAM = [
  { name: "Deneyimli Kadro", role: "Uzman ekip" },
  { name: "Sürekli Destek", role: "Müşteri başarısı" },
  { name: "Kalite Odaklı", role: "Standartlar" },
];

export default function TeamStrip() {
  return (
    <section className="py-12" aria-labelledby="team-heading">
      <div className="container-page">
        <h2 id="team-heading" className="mb-8 text-center font-display text-2xl font-bold text-foreground">
          {siteData.companyName} farkı
        </h2>
        <ul className="grid gap-6 sm:grid-cols-3">
          {TEAM.map((member) => (
            <li key={member.name} className="card-elevated text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-lg font-bold text-accent">
                {member.name.slice(0, 1)}
              </div>
              <h3 className="font-semibold text-foreground">{member.name}</h3>
              <p className="mt-1 text-sm text-muted">{member.role}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
