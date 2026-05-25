import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionCookie } from "@/lib/auth/session";
import { LoginApiSchema } from "@/schemas/auth.schema";
import { success, error } from "@/lib/response";
import { ValidationError, UnauthorizedError } from "@/lib/errors";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = LoginApiSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("参数校验失败", parsed.error.flatten().fieldErrors);
    }

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        avatar: true,
        bio: true,
        role: true,
        passwordHash: true,
        createdAt: true,
      },
    });

    if (!user) throw new UnauthorizedError("邮箱或密码错误");

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) throw new UnauthorizedError("邮箱或密码错误");

    await createSessionCookie({ userId: user.id, username: user.username });

    const { passwordHash: _, ...safeUser } = user;
    return success(safeUser, "登录成功");
  } catch (err) {
    return error(err);
  }
}
