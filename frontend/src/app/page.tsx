import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Building2,
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

const heroPreviewItems = [
  { title: "Open tender tracking", detail: "Live deadline watch", number: "01" },
  { title: "Awarded supplier visibility", detail: "Historical award context", number: "02" },
  { title: "Procuring entity details", detail: "Buyer and briefing clarity", number: "03" },
  { title: "Briefing and closing dates", detail: "Critical date fields captured", number: "04" },
];

const heroSignals = [
  { value: "30k+", label: "public tender records tracked" },
  { value: "1 place", label: "for deadlines, documents, and bid actions" },
  { value: "SA-first", label: "built around local tender workflows" },
];

export default function MarketingHomePage() {
  return (
    <MarketingShell>
      <main>
        <section className="relative overflow-hidden border-b border-border/70">
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(rgba(19,91,236,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(19,91,236,0.06)_1px,transparent_1px),radial-gradient(circle_at_top_left,rgba(19,91,236,0.22),transparent_24rem),radial-gradient(circle_at_80%_35%,rgba(89,158,255,0.16),transparent_22rem)] bg-[size:32px_32px,32px_32px,auto,auto] bg-[position:center,center,0_0,0_0]" />
          <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-background via-background/90 to-transparent" />
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.02fr)_minmax(420px,0.98fr)]">
              <div className="max-w-3xl space-y-8">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-bold text-primary shadow-sm shadow-primary/10">
                  <span className="size-2 rounded-full bg-primary" />
                  Built for South African businesses applying for tenders
                </div>

                <div className="space-y-5">
                  <h1 className="max-w-5xl text-5xl font-black tracking-[-0.04em] text-balance sm:text-6xl lg:text-7xl">
                    Win More Tenders
                    <br />
                    Without <span className="text-primary">Wasting Time</span>
                  </h1>
                  <p className="max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
                    TenderLens helps South African businesses discover relevant
                    tenders, analyse opportunities, compare requirements, and
                    track deadlines so your team can focus on bids worth
                    winning.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button size="lg" className="shadow-lg shadow-primary/20" asChild>
                    <a href={`${appUrl}/auth/register`}>
                      Start Free Tender Tracking
                      <ArrowRight className="ml-2 size-4" />
                    </a>
                  </Button>
                  <Button size="lg" variant="outline" className="bg-background/80" asChild>
                    <Link href="#latest-tenders">View Latest Tenders</Link>
                  </Button>
                </div>

                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-2">
                    <CheckCircle2 className="size-4 text-primary" />
                    Tender discovery and filtering
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-2">
                    <CheckCircle2 className="size-4 text-primary" />
                    Deadline and briefing tracking
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-2">
                    <CheckCircle2 className="size-4 text-primary" />
                    Workspace-ready bid actions
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {heroSignals.map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-2xl border border-border/70 bg-background/85 p-5 shadow-sm shadow-black/5 backdrop-blur"
                    >
                      <div className="text-3xl font-black text-primary">
                        {stat.value}
                      </div>
                      <div className="mt-2 max-w-[14ch] text-sm font-semibold leading-5 text-muted-foreground">
                        {stat.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative">
                <div className="absolute -left-10 top-10 hidden size-24 rounded-full bg-primary/10 blur-2xl lg:block" />
                <div className="absolute -right-8 bottom-0 hidden size-28 rounded-full bg-primary/15 blur-3xl lg:block" />
                <div className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-card/85 p-4 shadow-[0_30px_80px_rgba(16,22,34,0.14)] backdrop-blur sm:p-6">
                  <div className="rounded-[1.5rem] border border-border/70 bg-background/95 p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-4 border-b border-border/70 pb-4">
                      <div>
                        <div className="text-2xl font-black tracking-tight">
                          TenderLens
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Opportunity command center
                        </div>
                      </div>
                      <div className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
                        Live
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      {heroPreviewItems.map((item) => (
                        <div
                          key={item.number}
                          className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-4 shadow-sm shadow-black/5"
                        >
                          <div className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
                            <CheckCircle2 className="size-4 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold">{item.title}</div>
                            <div className="text-sm text-muted-foreground">
                              {item.detail}
                            </div>
                          </div>
                          <div className="text-sm font-semibold text-muted-foreground">
                            {item.number}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-border/70 bg-background/85 p-4">
                      <Building2 className="size-5 text-primary" />
                      <div className="mt-3 text-sm font-bold">Buyer context</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Procuring entity history and fit at a glance.
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/85 p-4">
                      <Timer className="size-5 text-primary" />
                      <div className="mt-3 text-sm font-bold">Critical dates</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Briefings, closings, and internal actions aligned.
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/85 p-4">
                      <GitCompareArrows className="size-5 text-primary" />
                      <div className="mt-3 text-sm font-bold">Bid decisions</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Compare effort, fit, and urgency before committing.
                      </div>
                    </div>
                  </div>
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
                  className="rounded-2xl border border-border bg-background p-6 shadow-sm shadow-black/5 transition-transform duration-200 hover:-translate-y-1"
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
                Move From Tender Discovery To Bid Decisions Faster
              </h2>
              <p className="mt-4 text-muted-foreground">
                Review the opportunity, understand the buyer, capture the key
                dates, and decide if the submission deserves team effort before
                the deadline pressure starts.
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
            <div className="grid gap-4">
              <div className="rounded-[1.75rem] border border-border bg-card p-6 shadow-sm shadow-black/5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-lg font-black">Tender review workflow</div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      A practical operating view for tender teams.
                    </p>
                  </div>
                  <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
                    Active
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {[
                    { icon: Landmark, title: "Procuring entities" },
                    { icon: Timer, title: "Deadline tracking" },
                    { icon: GitCompareArrows, title: "Tender comparison" },
                    { icon: ClipboardList, title: "Bid checklists" },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="rounded-2xl border border-border/70 bg-background p-5"
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
