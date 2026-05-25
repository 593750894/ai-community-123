import Link from "next/link";
import {
  BookOpen,
  Compass,
  MessageCircle,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";

const GUIDES = [
  {
    icon: BookOpen,
    label: "社区公约",
    href: "/community/rules",
    color: "text-cyan-400",
  },
  {
    icon: Compass,
    label: "频道导航",
    href: "/community",
    color: "text-violet-400",
  },
  {
    icon: MessageCircle,
    label: "发帖指南",
    href: "/create-post",
    color: "text-emerald-400",
  },
  {
    icon: Sparkles,
    label: "创作者计划",
    href: "/community/creator-program",
    color: "text-amber-400",
  },
];

export function BeginnerGuide() {
  return (
    <section className="surface-card overflow-hidden">
      <div className="border-b border-border/30 bg-gradient-to-r from-primary/8 via-transparent to-transparent px-4 py-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/90">
          <Compass className="size-3.5 text-primary" />
          新手入口
        </div>
      </div>
      <div className="p-2">
        {GUIDES.map((g) => (
          <Link
            key={g.href}
            href={g.href}
            className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50"
          >
            <g.icon className={`size-4 ${g.color}`} />
            <span className="flex-1 text-sm text-foreground/90 group-hover:text-foreground">
              {g.label}
            </span>
            <ArrowUpRight className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        ))}
      </div>
    </section>
  );
}
