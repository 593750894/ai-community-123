import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";

function publishHref(signedIn: boolean) {
  return signedIn ? "/create-post" : "/auth/login?next=/create-post";
}

export function PublishGuideCard({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <div className="surface-card overflow-hidden border-primary/20 bg-gradient-to-br from-primary/8 via-card/40 to-fuchsia-500/5 p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15">
          <Sparkles className="size-4 text-primary" />
        </div>
        <div className="space-y-2">
          <p className="text-sm leading-relaxed text-foreground/85">
            正在研究 Seedance、Kling、ComfyUI 或数字人？发个帖子和同行聊聊。
          </p>
          <Link
            href={publishHref(signedIn)}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
          >
            立即发布
            <ArrowRight className="size-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
