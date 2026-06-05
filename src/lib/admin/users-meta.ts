// Stage 9：admin 用户管理元数据。client-safe（不含 server actions）。

export const ADMIN_ROLE_VALUES = ["USER", "MOD", "ADMIN"] as const;
export type AdminRoleValue = (typeof ADMIN_ROLE_VALUES)[number];

// DELETED 状态留给用户自删（/api/me DELETE），admin 不能手动设置
export const ADMIN_STATUS_VALUES = ["ACTIVE", "SUSPENDED", "BANNED"] as const;
export type AdminStatusValue = (typeof ADMIN_STATUS_VALUES)[number];

export const ROLE_LABEL: Record<string, string> = {
  USER: "普通用户",
  MOD: "版主",
  ADMIN: "管理员",
};

export const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "正常",
  SUSPENDED: "已禁言",
  BANNED: "已封禁",
  DELETED: "已注销",
};
