import { redirect } from "next/navigation";

// 阶段 6：发布作品页统一改至 /create-work。
export default function ShowcaseUploadPage() {
  redirect("/create-work");
}
