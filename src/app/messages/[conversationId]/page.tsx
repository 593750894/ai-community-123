import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, UserRound } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { MessageComposer } from "@/components/feed/message-composer";
import { getSession } from "@/lib/auth/session";
import {
  getConversationForUser,
  markConversationRead,
} from "@/lib/messages/queries";

export const dynamic = "force-dynamic";

const TIME_FMT = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
});
const DATE_FMT = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  const session = await getSession();
  if (!session) {
    redirect(
      `/auth/login?next=${encodeURIComponent(`/messages/${conversationId}`)}`,
    );
  }

  const detail = await getConversationForUser(conversationId, session.userId);
  if (!detail) notFound();

  // 打开会话即标记已读
  await markConversationRead(conversationId, session.userId);

  const other = detail.otherUser;

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        eyebrow="私信"
        title={other?.name ?? "未知用户"}
        description={
          other?.industryRole
            ? `@${other.username} · ${other.industryRole}`
            : other
              ? `@${other.username}`
              : undefined
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/messages" />}
            >
              <ArrowLeft className="size-3.5" />
              返回列表
            </Button>
            {other && (
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href={`/profile/${other.id}`} />}
              >
                <UserRound className="size-3.5" />
                查看主页
              </Button>
            )}
          </div>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col px-6 pb-4 sm:px-8">
        <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-border/60 bg-card/20">
          <div className="flex-1 space-y-3 overflow-y-auto p-5">
            {detail.messages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center text-xs text-muted-foreground">
                这是一个新会话。说点什么打个招呼吧～
              </div>
            ) : (
              detail.messages.map((m, idx) => {
                const prev = detail.messages[idx - 1];
                const showDate =
                  !prev || !isSameDay(prev.createdAt, m.createdAt);
                const self = m.senderId === session.userId;
                return (
                  <div key={m.id} className="space-y-2">
                    {showDate && (
                      <div className="text-center text-[11px] text-muted-foreground">
                        {DATE_FMT.format(m.createdAt)}
                      </div>
                    )}
                    <div
                      className={`flex gap-2 ${self ? "justify-end" : "justify-start"}`}
                    >
                      {!self &&
                        (other?.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={other.avatar}
                            alt={other.name}
                            className="size-7 shrink-0 rounded-full border border-border/60 object-cover"
                          />
                        ) : (
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-300 to-purple-500 text-[11px] font-semibold text-black/70">
                            {other?.name?.slice(0, 1) ?? "?"}
                          </span>
                        ))}
                      <div
                        className={`max-w-md whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${
                          self
                            ? "rounded-tr-sm bg-primary text-primary-foreground"
                            : "rounded-tl-sm bg-card/70 text-foreground/95"
                        }`}
                      >
                        {m.content}
                        <div
                          className={`mt-1 text-[10px] ${
                            self
                              ? "text-primary-foreground/70"
                              : "text-muted-foreground"
                          }`}
                        >
                          {TIME_FMT.format(m.createdAt)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-border/60 p-3">
            <MessageComposer conversationId={detail.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
