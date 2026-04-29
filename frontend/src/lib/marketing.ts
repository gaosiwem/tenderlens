export const marketingUrl =
  process.env.NEXT_PUBLIC_MARKETING_URL ??
  (process.env.NODE_ENV === "development"
    ? "http://localhost:3005"
    : "https://tenderlens.co.za");

export const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.NODE_ENV === "development" ? "" : "https://app.tenderlens.co.za");

export type BlogArticle = {
  slug: string;
  title: string;
  description: string;
  sections: Array<{
    heading: string;
    body: string;
  }>;
};

function article(
  slug: string,
  title: string,
  description: string,
  focus: string,
): BlogArticle {
  return {
    slug,
    title,
    description,
    sections: [
      {
        heading: "Why It Matters",
        body: `${focus} matters because tender opportunities move quickly. A structured process helps your team spot relevant bids early, understand the requirements, and avoid rushed decisions close to the deadline.`,
      },
      {
        heading: "What To Check First",
        body: "Start with the closing date, briefing requirements, tender number, buyer, location, compulsory documents, eligibility rules, and submission method. These basics tell you whether the opportunity is realistic before your team spends time on the full bid.",
      },
      {
        heading: "How TenderLens Helps",
        body: "TenderLens helps South African businesses centralise tender discovery, track deadlines, compare opportunities, and keep tender documents and actions organised in one workspace.",
      },
    ],
  };
}

export const blogArticles: BlogArticle[] = [
  article(
    "how-to-find-government-tenders-in-south-africa",
    "How to Find Government Tenders in South Africa",
    "Find government tenders in South Africa using official portals, municipal websites, tender alerts, and a structured tracking system.",
    "Finding government tenders consistently",
  ),
  article(
    "how-to-apply-for-tenders-in-south-africa",
    "How to Apply for Tenders in South Africa",
    "Learn how to apply for tenders in South Africa, prepare documents, review requirements, and submit stronger bids before deadline.",
    "Applying for tenders with discipline",
  ),
  article(
    "tender-documents-required-south-africa",
    "What Documents Are Required for Tender Applications in South Africa?",
    "A practical checklist of common tender documents South African businesses need before applying for government and private tenders.",
    "Preparing tender documents before the rush",
  ),
  article(
    "avoid-missing-tender-deadlines",
    "How to Avoid Missing Tender Deadlines",
    "Learn practical ways to track tender deadlines, set reminders, and avoid rushed or late submissions.",
    "Avoiding missed tender deadlines",
  ),
  article(
    "where-to-find-municipal-tenders-south-africa",
    "Where to Find Municipal Tenders in South Africa",
    "Find municipal tenders in South Africa using municipal websites, eTenders, procurement portals, and alerts.",
    "Tracking municipal tender sources",
  ),
  article(
    "rfq-vs-tender-difference",
    "RFQ vs Tender: What Is the Difference?",
    "Understand the difference between RFQs, RFPs, and tenders so your business can respond to the right opportunities.",
    "Choosing the right procurement opportunity",
  ),
  article(
    "how-smes-can-win-more-government-tenders",
    "How SMEs Can Win More Government Tenders in South Africa",
    "Practical guidance for SMEs to choose better tenders, prepare stronger bids, and improve tender win rates.",
    "Helping SMEs compete for government work",
  ),
  article(
    "common-reasons-tender-applications-are-rejected",
    "Common Reasons Tender Applications Are Rejected",
    "Avoid common tender mistakes such as missing documents, late submissions, non-compliance, and unclear pricing.",
    "Reducing preventable tender rejection risk",
  ),
  article(
    "how-tender-alerts-help-businesses-save-time",
    "How Tender Alerts Help Businesses Save Time",
    "Tender alerts help businesses discover opportunities earlier, reduce manual searching, and prepare bids with more time.",
    "Using tender alerts to reduce manual searching",
  ),
  article(
    "how-to-decide-if-a-tender-is-worth-applying-for",
    "How to Decide If a Tender Is Worth Applying For",
    "Learn how to evaluate tender fit, capacity, profitability, deadline pressure, and risk before investing time in a bid.",
    "Deciding whether a tender is worth the effort",
  ),
  article(
    "top-tender-websites-in-south-africa",
    "Top Tender Websites in South Africa",
    "A guide to common tender websites and portals in South Africa, including how to manage scattered opportunities.",
    "Managing scattered tender websites",
  ),
  article(
    "track-tender-opportunities-effectively",
    "How to Track Tender Opportunities Effectively",
    "Learn how to organize tender opportunities, track deadlines, assign actions, and avoid losing opportunities in spreadsheets.",
    "Tracking tender opportunities without spreadsheet chaos",
  ),
  article(
    "improve-tender-win-rate",
    "How to Improve Your Tender Win Rate",
    "Improve tender win rate by choosing better opportunities, improving compliance, and building repeatable bid processes.",
    "Improving tender win rate through better process",
  ),
  article(
    "tender-checklist-for-south-african-businesses",
    "Tender Checklist for South African Businesses",
    "A tender readiness checklist covering registration, tax, B-BBEE, pricing, experience, and submission requirements.",
    "Building a tender readiness checklist",
  ),
  article(
    "what-happens-after-you-submit-a-tender",
    "What Happens After You Submit a Tender?",
    "Understand what happens after tender submission, including evaluation, clarification, award, regret letters, and feedback.",
    "Understanding what happens after submission",
  ),
  article(
    "build-tender-strategy-for-business",
    "How to Build a Tender Strategy for Your Business",
    "Build a practical tender strategy around target sectors, opportunity tracking, compliance, pricing, and bid discipline.",
    "Building a practical tender strategy",
  ),
];

export function getBlogArticle(slug: string) {
  return blogArticles.find((article) => article.slug === slug) ?? null;
}

export const marketingStats = [
  { value: "30k+", label: "public tender records tracked" },
  { value: "1 place", label: "for deadlines, documents, and bid actions" },
  { value: "SA-first", label: "built around local tender workflows" },
];

export const marketingFeatures = [
  {
    title: "Discover Relevant Tenders",
    description:
      "Search and filter public tender opportunities by deadline, buyer, province, category, and tender number.",
  },
  {
    title: "Understand Requirements Faster",
    description:
      "Review tender details, documents, briefing information, and submission signals without scattered manual tracking.",
  },
  {
    title: "Track Deadlines With Discipline",
    description:
      "Keep tenders, due dates, reminders, documents, and internal bid tasks in one repeatable operating rhythm.",
  },
  {
    title: "Compare Bid Opportunities",
    description:
      "Compare deadlines, documents, eligibility requirements, scope, and tender fit before committing team time.",
  },
  {
    title: "Prepare Better Submissions",
    description:
      "Turn tender information into checklists, summaries, and workspace actions your team can follow.",
  },
  {
    title: "Build Tender Memory",
    description:
      "Keep tender outcomes, awarded suppliers, procuring entities, and historical context visible for future strategy.",
  },
];
