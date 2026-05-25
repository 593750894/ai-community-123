import { redirect } from "next/navigation";

// 阶段 4 起，发帖统一走 /create-post。保留旧路径以便老链接 / 老书签不 404。
export default function CommunityNewRedirect() {
  redirect("/create-post");
}
