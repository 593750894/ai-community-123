import { prisma, Prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { createSessionCookie } from "@/lib/auth/session";
import { RegisterApiSchema } from "@/schemas/auth.schema";
import { created, error } from "@/lib/response";
import { ValidationError, ConflictError } from "@/lib/errors";

function generateUsername(email: string): string {
  const prefix = email.split("@")[0].replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 16);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${suffix}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = RegisterApiSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("参数校验失败", parsed.error.flatten().fieldErrors);
    }

    const { email, password, name, role, bio } = parsed.data;
    const passwordHash = await hashPassword(password);
    const username = generateUsername(email);

    const user = await prisma.user.create({
      data: {
        email,
        username,
        name,
        passwordHash,
        avatar: `https://api.dicebear.com/9.x/glass/svg?seed=${encodeURIComponent(username)}`,
        ...(role && { role }),
        ...(bio && { bio }),
      },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        avatar: true,
        bio: true,
        role: true,
        createdAt: true,
      },
    });

    await createSessionCookie({ userId: user.id, username: user.username });

    return created(user, "注册成功");
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return error(new ConflictError("该邮箱已被注册"));
    }
    return error(err);
  }
}
