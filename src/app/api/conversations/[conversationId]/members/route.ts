import { requireAuth } from "@/lib/auth/guard";
import { requireActiveUser } from "@/lib/auth/suspension";
import { ValidationError } from "@/lib/errors";
import { success, created, error } from "@/lib/response";
import { AddGroupMembersSchema } from "@/lib/messages/schemas";
import {
  addGroupMembers,
  listGroupMembers,
} from "@/lib/messages/groups";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  try {
    const user = await requireAuth();
    const { conversationId } = await params;
    const members = await listGroupMembers(user.id, conversationId);
    return success(members);
  } catch (err) {
    return error(err);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  try {
    const user = await requireAuth();
    await requireActiveUser(user);
    const { conversationId } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = AddGroupMembersSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        "参数校验失败",
        parsed.error.flatten().fieldErrors,
      );
    }
    const result = await addGroupMembers(user.id, conversationId, parsed.data);
    return created(result, "成员已加入");
  } catch (err) {
    return error(err);
  }
}
