"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, X, Sparkles, FileVideo, Handshake } from "lucide-react";

import { cn } from "@/lib/utils";

const ACTIONS = [
  { href: "/create-post", icon: Sparkles, label: "发帖", color: "text-blue-400" },
  { href: "/showcase/upload", icon: FileVideo, label: "发作品", color: "text-cyan-400" },
  { href: "/collaboration/new", icon: Handshake, label: "发合作", color: "text-emerald-400" },
] as const;

export function QuickPublishButton() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed right-6 bottom-6 z-50 flex flex-col items-end gap-2">
      {open &&
        ACTIONS.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="flex items-center gap-2 rounded-full border border-border/40 bg-card/90 px-4 py-2 text-sm font-medium shadow-lg backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:shadow-xl"
          >
            <a.icon className={cn("size-4", a.color)} />
            {a.label}
          </Link>
        ))}

      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-xl",
          open && "rotate-45",
        )}
      >
        {open ? <X className="size-5" /> : <Plus className="size-5" />}
      </button>
    </div>
  );
}
