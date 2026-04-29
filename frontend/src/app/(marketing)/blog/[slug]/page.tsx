import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { Button } from "@/components/ui/button";
import {
  appUrl,
  blogArticles,
  getBlogArticle,
  marketingUrl,
} from "@/lib/marketing";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return blogArticles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getBlogArticle(slug);
  if (!article) return {};

  return {
    title: `${article.title} | TenderLens`,
    description: article.description,
    alternates: {
      canonical: `${marketingUrl}/blog/${article.slug}`,
    },
    openGraph: {
      title: article.title,
      description: article.description,
      url: `${marketingUrl}/blog/${article.slug}`,
      siteName: "TenderLens",
      type: "article",
    },
  };
}

export default async function BlogArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = getBlogArticle(slug);
  if (!article) notFound();

  const related = blogArticles
    .filter((item) => item.slug !== article.slug)
    .slice(0, 3);

  return (
    <MarketingShell>
      <main>
        <article>
          <header className="border-b border-border/70">
            <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
              <Link
                href="/blog"
                className="inline-flex items-center gap-2 text-sm font-bold text-primary"
              >
                <ArrowLeft className="size-4" />
                Back to guides
              </Link>
              <h1 className="mt-8 text-4xl font-black tracking-tight sm:text-5xl">
                {article.title}
              </h1>
              <p className="mt-5 text-lg leading-8 text-muted-foreground">
                {article.description}
              </p>
            </div>
          </header>

          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8">
            <div className="space-y-8">
              {article.sections.map((section) => (
                <section
                  key={section.heading}
                  className="rounded-xl border border-border bg-card p-6"
                >
                  <h2 className="text-2xl font-black tracking-tight">
                    {section.heading}
                  </h2>
                  <p className="mt-4 leading-8 text-muted-foreground">
                    {section.body}
                  </p>
                </section>
              ))}

              <section className="rounded-xl border border-primary/20 bg-primary/10 p-6">
                <h2 className="text-2xl font-black tracking-tight">
                  Tender Readiness Checklist
                </h2>
                <div className="mt-5 grid gap-3">
                  {[
                    "Confirm the closing date and submission method.",
                    "Check briefing session requirements.",
                    "List compulsory documents and forms.",
                    "Review eligibility and compliance rules.",
                    "Decide whether the tender is a good fit before bidding.",
                  ].map((item) => (
                    <div key={item} className="flex gap-3">
                      <CheckCircle2 className="mt-1 size-4 shrink-0 text-primary" />
                      <span className="text-sm text-muted-foreground">
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
                <Button className="mt-6" asChild>
                  <a href={`${appUrl}/auth/register`}>
                    Track tenders in TenderLens
                  </a>
                </Button>
              </section>
            </div>

            <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="text-sm font-black uppercase tracking-[0.16em] text-primary">
                  Related Guides
                </div>
                <div className="mt-4 space-y-4">
                  {related.map((item) => (
                    <Link
                      key={item.slug}
                      href={`/blog/${item.slug}`}
                      className="group block rounded-lg border border-border/70 p-3 hover:border-primary/40"
                    >
                      <div className="text-sm font-bold group-hover:text-primary">
                        {item.title}
                      </div>
                      <div className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary">
                        Read next
                        <ArrowRight className="size-3" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </article>
      </main>
    </MarketingShell>
  );
}
