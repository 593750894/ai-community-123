import { AccountForm } from "@/components/settings/account-form";
import { PasswordEmailForm } from "@/components/settings/password-email-form";
import { DeleteAccountForm } from "@/components/settings/delete-account-form";
import { requireUser } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export default async function SettingsAccountPage() {
  const user = await requireUser("/settings/account");
  return (
    <div className="space-y-6 px-6 py-6 sm:px-8">
      <section className="rounded-2xl border border-border bg-card/40 p-5">
        <h2 className="mb-1 text-sm font-medium">基本资料</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          这些字段会出现在你的个人主页上。
        </p>
        <AccountForm
          initial={{
            name: user.name,
            avatar: user.avatar,
            bio: user.bio,
            industryRole: user.industryRole,
            expertise: user.expertise,
            favoriteTools: user.favoriteTools,
            portfolioLinks: user.portfolioLinks,
            contact: user.contact,
          }}
        />
      </section>

      <section className="rounded-2xl border border-border bg-card/40 p-5">
        <h2 className="mb-1 text-sm font-medium">账户安全</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          修改邮箱或密码后，所有其他设备上的登录态会失效。
        </p>
        <PasswordEmailForm currentEmail={user.email} />
      </section>

      <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
        <h2 className="mb-1 text-sm font-medium text-destructive">注销账户</h2>
        <ul className="mb-4 list-disc space-y-1 pl-4 text-xs text-destructive/80">
          <li>注销后该账号无法再登录，其他设备的登录态立即失效。</li>
          <li>
            个人资料（昵称 / 头像 / 简介 / 联系方式 / 作品链接）会被清空，
            主页显示「已注销」。
          </li>
          <li>已发布的帖子 / 作品 / 评论会保留，作者署名变为「已注销」。</li>
          <li>邮箱和用户名仍占位，暂不可被其他人重新注册。</li>
          <li>
            此操作不可逆。若误操作，请尽快联系管理员；目前没有自助恢复入口。
          </li>
        </ul>
        <DeleteAccountForm />
      </section>
    </div>
  );
}
