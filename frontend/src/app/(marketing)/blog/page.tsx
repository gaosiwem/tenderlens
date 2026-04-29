import type { Metadata } from "next";
import { BlogCard } from "@/components/marketing/blog-card";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { Button } from "@/components/ui/button";
import { appUrl, blogArticles, marketingUrl } from "@/lib/marketing";

export const metadata: Metadata = {
  title: "Tender Guides",
  description:
    "Tender guides for South African businesses. Learn how to find, apply for, and track tenders.",
  alternates: {
    canonical: `${marketingUrl}/blog`,
  },
  openGraph: {
    title: "Tender Guides",
    description:
      "Practical SEO guides for South African businesses that want to find, analyse, and track tender opportunities.",
    url: `${marketingUrl}/blog`,
    siteName: "TenderLens",
    type: "website",
  },
};

export default function BlogIndexPage() {
  return (
    <MarketingShell>
      <main>
        <section className="relative overflow-hidden border-b border-border/70">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(19,91,236,0.18),transparent_28rem)]" />
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
                Tender guides for South African businesses
              </div>
              <h1 className="mt-6 text-5xl font-black tracking-tight sm:text-6xl">
                Tender <span className="text-primary">Guides</span>
              </h1>
              <p className="mt-5 text-lg leading-8 text-muted-foreground">
                Practical SEO guides for South African businesses that want to
                find, analyse, and track tender opportunities.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" asChild>
                  <a href={`${appUrl}/auth/register`}>
                    Start Free Tender Tracking
                  </a>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <a href="/">Back to TenderLens</a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-10 max-w-3xl">
            {/* <div className="text-sm font-black uppercase tracking-[0.2em] text-primary">
              Tender Guides
            </div> */}
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              Learn Tender Tracking, Compliance, and Bid Readiness
            </h2>
            <p className="mt-4 text-muted-foreground">
              Clear, practical articles for teams that need better tender
              search, deadline tracking, document preparation, and bid decisions.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {blogArticles.map((article) => (
              <BlogCard key={article.slug} article={article} />
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-primary/20 bg-primary/10 p-8 text-center sm:p-12">
            <h2 className="text-3xl font-black tracking-tight">
              Turn Tender Advice Into a Repeatable Process
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Use TenderLens to discover tender opportunities, analyse
              requirements, and track submission deadlines in one place.
            </p>
            <Button className="mt-8" size="lg" asChild>
              <a href={`${appUrl}/auth/register`}>Start Free Tender Tracking</a>
            </Button>
          </div>
        </section>
      </main>
    </MarketingShell>
  );
}
