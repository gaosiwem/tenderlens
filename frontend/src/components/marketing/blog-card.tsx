import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { BlogArticle } from "@/lib/marketing";

export function BlogCard({ article }: { article: BlogArticle }) {
  return (
    <article className="group flex min-h-48 flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg">
      <div className="space-y-3">
        <h3 className="text-lg font-extrabold tracking-tight text-foreground">
          <Link href={`/blog/${article.slug}`} className="hover:text-primary">
            {article.title}
          </Link>
        </h3>
        <p className="text-sm leading-6 text-muted-foreground">
          {article.description}
        </p>
      </div>
      <Link
        href={`/blog/${article.slug}`}
        className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-primary"
      >
        Read guide
        <ArrowRight className="size-4 transition group-hover:translate-x-1" />
      </Link>
    </article>
  );
}
