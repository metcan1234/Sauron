import type { Metadata } from "next";
import Section from "@/components/Section";
import { siteData } from "@/lib/site-data";

export const metadata: Metadata = {
  title: "{{PAGE_BLOG_SEO_TITLE}}",
  description: "{{PAGE_BLOG_SEO_DESCRIPTION}}",
};

const POSTS = [
  {
    title: "Sektörde dijital dönüşüm trendleri",
    excerpt: "Kurumsal süreçlerde verimlilik ve müşteri deneyimini artıran yaklaşımlar.",
    date: "2026-01-15",
  },
  {
    title: "Güvenilir iş ortaklığı nasıl kurulur?",
    excerpt: "Uzun vadeli başarı için şeffaflık ve ölçülebilir hedefler.",
    date: "2025-12-02",
  },
];

export default function BlogPage() {
  return (
    <Section
      eyebrow="Blog"
      title="Haberler ve içgörüler"
      description={`${siteData.companyName} ekibinden güncel yazılar.`}
    >
      <ul className="space-y-6">
        {POSTS.map((post) => (
          <li key={post.title} className="card-elevated">
            <time className="text-xs text-muted" dateTime={post.date}>
              {post.date}
            </time>
            <h2 className="mt-2 font-display text-xl font-semibold text-foreground">{post.title}</h2>
            <p className="mt-2 text-sm text-muted">{post.excerpt}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
