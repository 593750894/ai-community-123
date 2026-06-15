"use client";

import { useState } from "react";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { adminSetUserStatus } from "@/lib/admin/users";

/**
 * Stage 17.5：admin 禁言对话框。
 *
 * 设计：
 *   - 禁言必须填原因（≤200 字）。
 *   - 默认「指定到期时间」（datetime-local），最短 1h，最长 1 年；
 *     可切换「永久禁言」（suspendUntil 留空，后端把 null 持久化 → cron 不会自动解禁）。
 *   - 表单直接 action=adminSetUserStatus（server action），无须客户端 fetch。
 *   - 内部表单 mount/unmount 控制状态初始化（仓库规则）。
 */

export interface SuspendUserDialogProps {
  userId: string;
  username: string;
  /** 当前是否已经处于 SUSPENDED 状态（用于「重新禁言」入口的措辞）。 */
  alreadySuspended?: boolean;
}

function defaultUntilLocal(): string {
  // 默认禁言 7 天，转 datetime-local 输入格式（YYYY-MM-DDTHH:mm，本地时区）。
  const target = new Date(Date.now() + 7 * 86_400_000);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}T${pad(target.getHours())}:${pad(target.getMinutes())}`;
}

function SuspendForm({
  userId,
  username,
  alreadySuspended,
  onCancel,
}: SuspendUserDialogProps & { onCancel: () => void }) {
  const [permanent, setPermanent] = useState(false);
  const [until, setUntil] = useState<string>(defaultUntilLocal());
  const [reason, setReason] = useState("");
  return (
    <form action={adminSetUserStatus}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="status" value="SUSPENDED" />
      {/* permanent=true 时不提交 suspendUntil 字段；server 把缺省视为永久 */}
      {!permanent ? (
        <input
          type="hidden"
          name="suspendUntil"
          value={new Date(until).toISOString()}
          readOnly
        />
      ) : null}
      <DialogBody>
        <p className="text-sm text-muted-foreground">
          {alreadySuspended
            ? `修改 @${username} 当前禁言期与原因。`
            : `禁言 @${username} 后用户仍可登录浏览，但所有发布 / 评论 / 私信 / 互动均被拒绝。`}
        </p>

        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            原因（必填，≤200 字）
          </label>
          <textarea
            name="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 200))}
            placeholder="例如：连续发布违反社区公约内容（举报 #12345）"
            rows={3}
            required
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-paper-1 focus:border-primary focus:outline-none"
          />
          <p className="text-[10px] text-muted-foreground">
            {reason.length} / 200
          </p>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            到期方式
          </legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="_mode"
              checked={!permanent}
              onChange={() => setPermanent(false)}
            />
            <span>指定到期时间（cron 自动解禁）</span>
          </label>
          {!permanent ? (
            <input
              type="datetime-local"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
              required
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm shadow-paper-1 focus:border-primary focus:outline-none"
            />
          ) : null}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="_mode"
              checked={permanent}
              onChange={() => setPermanent(true)}
            />
            <span>永久禁言（仅 admin 手动解除）</span>
          </label>
        </fieldset>
      </DialogBody>

      <DialogFooter>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-border bg-background px-4 py-1.5 text-sm hover:bg-muted/50"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={reason.trim().length === 0}
          className="rounded-full bg-tag-amber-bg px-4 py-1.5 text-sm font-medium text-tag-amber-fg hover:opacity-90 disabled:opacity-50"
        >
          {alreadySuspended ? "更新禁言" : "禁言用户"}
        </button>
      </DialogFooter>
    </form>
  );
}

export function SuspendUserDialog(props: SuspendUserDialogProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-tag-amber-bg bg-tag-amber-bg/60 px-2 py-0.5 text-[11px] font-medium text-tag-amber-fg hover:bg-tag-amber-bg"
      >
        {props.alreadySuspended ? "修改禁言" : "禁言"}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {props.alreadySuspended ? "修改禁言" : "禁言用户"}
            </DialogTitle>
          </DialogHeader>
          {open ? (
            <SuspendForm {...props} onCancel={() => setOpen(false)} />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
