export {
  RegisterSchema,
  LoginSchema,
  UpdateProfileSchema,
  type RegisterInput,
  type LoginInput,
  type UpdateProfileInput,
} from "@/lib/auth/schemas";

export {
  CreatePostSchema,
  type CreatePostInput,
} from "@/lib/posts/schemas";

export {
  CreateWorkSchema,
  type CreateWorkInput,
} from "@/lib/works/schemas";

export {
  CreateCollaborationSchema,
  UpdateCollabStatusSchema,
  type CreateCollaborationInput,
} from "@/lib/collaborations/schemas";

export {
  CreateToolSchema,
  type CreateToolInput,
} from "@/schemas/tool.schema";

export {
  StartConversationSchema,
  SendMessageSchema,
  type StartConversationInput,
  type SendMessageInput,
} from "@/lib/messages/schemas";

export {
  CreateCommentSchema,
  type CreateCommentInput,
} from "@/lib/comments/schemas";

export {
  RegisterApiSchema,
  LoginApiSchema,
  type RegisterApiInput,
  type LoginApiInput,
} from "@/schemas/auth.schema";
