import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  ClipboardList,
  FileSearch,
  GitCompareArrows,
  Landmark,
  Timer,
} from "lucide-react";
import { BlogCard } from "@/components/marketing/blog-card";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { Button } from "@/components/ui/button";
import {
  appUrl,
  blogArticles,
  marketingFeatures,
  marketingStats,
  marketingUrl,
} from "@/lib/marketing";

export const metadata: Metadata = {
  title: "Find Government Tenders in South Africa | TenderLens",
  description:
    "Find and track government tenders in South Africa. TenderLens helps businesses discover opportunities, analyse requirements, and never miss deadlines.",
  alternates: {
    canonical: marketingUrl,
  },
  openGraph: {
    title: "Find Government Tenders in South Africa | TenderLens",
    description:
      "Discover, analyse, and track tender opportunities with TenderLens.",
    url: marketingUrl,
    siteName: "TenderLens",
    type: "website",
  },
};

const steps = [
  {
    icon: FileSearch,
    title: "Discover Relevant Tenders",
    description:
      "Find public tender opportunities and filter them by category, province, buyer, deadline, and keywords.",
  },
  {
    icon: ClipboardList,
    title: "Analyse Requirements",
    description:
      "Review tender details, documents, briefing requirements, deadlines, and compliance signals before committing.",
  },
  {
    icon: Bell,
    title: "Track Work To Deadline",
    description:
      "Save tenders, assign bid actions, compare opportunities, and keep your team focused on submissions worth pursuing.",
  },
];

const latestTenderSignals = [
  "Open tender tracking",
  "Awarded supplier visibility",
  "Procuring entity details",
  "Briefing and closing date fields",
];

export default function MarketingHomePage() {
  return (
    <MarketingShell>
      <main>
        <section className="relative overflow-hidden border-b border-border/70">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(19,91,236,0.20),transparent_32rem),radial-gradient(circle_at_bottom_right,rgba(89,158,255,0.14),transparent_28rem)]" />
          <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:px-8">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
                <span className="size-2 rounded-full bg-primary" />
                Built for South African businesses applying for tenders
              </div>

              <div className="space-y-5">
                <h1 className="max-w-4xl text-5xl font-black tracking-tight sm:text-6xl lg:text-7xl">
                  Win More Tenders Without{" "}
                  <span className="text-primary">Wasting Time</span>
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
                  TenderLens helps South African businesses discover relevant
                  tenders, analyse opportunities, compare requirements, and
                  track deadlines so your team can focus on bids worth winning.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button size="lg" asChild>
                  <a href={`${appUrl}/auth/register`}>
                    Start Free Tender Tracking
                    <ArrowRight className="ml-2 size-4" />
                  </a>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="#latest-tenders">View Latest Tenders</Link>
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {marketingStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-border/70 bg-card/70 p-4"
                  >
                    <div className="text-2xl font-black text-primary">
                      {stat.value}
                    </div>
                    <div className="mt-1 text-xs font-semibold text-muted-foreground">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 shadow-2xl">
              <div className="rounded-lg border border-border/70 bg-background p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-black">TenderLens</div>
                    <div className="text-xs text-muted-foreground">
                      Opportunity command center
                    </div>
                  </div>
                  <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                    Live
                  </div>
                </div>
                <div className="space-y-3">
                  {latestTenderSignals.map((item, index) => (
                    <div
                      key={item}
                      className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="size-4 text-primary" />
                        <span className="text-sm font-semibold">{item}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        0{index + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="text-sm font-black uppercase tracking-[0.2em] text-primary">
              How It Works
            </div>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              Find, Analyse, and Track Tenders in One Place
            </h2>
            <p className="mt-4 text-muted-foreground">
              Move from manual searching and spreadsheets to a repeatable
              tender workflow your whole team can follow.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {steps.map((step) => (
              <div
                key={step.title}
                className="rounded-xl border border-border bg-card p-6 shadow-sm"
              >
                <div className="mb-5 inline-flex rounded-lg border border-primary/20 bg-primary/10 p-3 text-primary">
                  <step.icon className="size-5" />
                </div>
                <h3 className="text-lg font-black">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section id="features" className="border-y border-border/70 bg-card/30">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <div className="text-sm font-black uppercase tracking-[0.2em] text-primary">
                Benefits
              </div>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                Stop Searching Manually. Start Bidding Strategically.
              </h2>
            </div>
            <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {marketingFeatures.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-xl border border-border bg-background p-6"
                >
                  <h3 className="text-lg font-black">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="latest-tenders" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div>
              <div className="text-sm font-black uppercase tracking-[0.2em] text-primary">
                Latest Tenders
              </div>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                Keep Tender Opportunities Moving
              </h2>
              <p className="mt-4 text-muted-foreground">
                TenderLens gives your team a practical way to review tenders,
                preserve documents, monitor deadlines, and understand which
                opportunities deserve attention.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild>
                  <a href={`${appUrl}/auth/register`}>View All Tenders</a>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/blog">Read Tender Guides</Link>
                </Button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { icon: Landmark, title: "Procuring entities" },
                { icon: Timer, title: "Deadline tracking" },
                { icon: GitCompareArrows, title: "Tender comparison" },
                { icon: ClipboardList, title: "Bid checklists" },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-border bg-card p-5"
                >
                  <item.icon className="mb-4 size-6 text-primary" />
                  <div className="font-black">{item.title}</div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Built into a single operating view for tender teams.
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-border/70 bg-card/30">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-sm font-black uppercase tracking-[0.2em] text-primary">
                  Tender Guides
                </div>
                <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                  Learn the Tender Process
                </h2>
              </div>
              <Button variant="outline" asChild>
                <Link href="/blog">View all guides</Link>
              </Button>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {blogArticles.slice(0, 3).map((article) => (
                <BlogCard key={article.slug} article={article} />
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-primary/20 bg-primary/10 p-8 text-center sm:p-12">
            <h2 className="text-3xl font-black tracking-tight">
              Start Tracking Better Tender Opportunities
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Use TenderLens to discover, analyse, and track tenders before
              deadlines become a problem.
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
