"use client";

import { useRef } from "react";

// Stage 9：极简 confirm 包装。原生 confirm() 在所有桌面浏览器都可用，
// 不必为 MVP 引入完整 dialog。点确认才提交 form。

export function ConfirmForm({
  action,
  message,
  className,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  message: string;
  className?: string;
  children: React.ReactNode;
}) {
  const formRef = useRef<HTMLFormElement | null>(null);
  return (
    <form
      ref={formRef}
      action={action}
      className={className}
      onSubmit={(e) => {
        if (!window.confirm(message)) {
          e.preventDefault();
        }
      }}
    >
      {children}
    </form>
  );
}
