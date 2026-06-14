"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Dialog 原语 — 统一 ~6 个手搓 modal 的 a11y 行为。
 *
 * WCAG 行为契约：
 *   - role="dialog" + aria-modal="true"
 *   - aria-labelledby 由调用方传入（DialogTitle 自动生成 id 时也会同步）
 *   - Tab/Shift+Tab 在 panel 内循环（焦点陷阱）
 *   - 打开时把焦点送到首个 focusable（或带 [data-autofocus] 的元素）
 *   - 关闭时把焦点送回触发它的元素
 *   - Esc 关闭（closeOnEscape={false} 可禁用）
 *   - 点遮罩关闭（closeOnBackdrop={false} 可禁用）
 *   - 打开时锁 body 滚动
 *   - Portal 到 document.body
 *
 * 内部走原生 <button>（不走 Button 组件）只有遮罩与面板根节点；
 * 关闭按钮按 brief 用 <Button variant="ghost" size="icon-sm">。
 */

// ---------- Context ----------

interface DialogContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titleId: string;
  setTitleId: (id: string) => void;
  ariaLabelledBy: string | undefined;
  ariaDescribedBy: string | undefined;
}

const DialogContext = createContext<DialogContextValue | null>(null);

function useDialogContext(component: string): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error(`<${component}> must be used inside <Dialog>`);
  }
  return ctx;
}

// ---------- Sizes ----------

const DIALOG_SIZES = {
  sm: "max-w-[400px]",
  md: "max-w-[520px]",
  lg: "max-w-[720px]",
} as const;

export type DialogSize = keyof typeof DIALOG_SIZES;

// ---------- Body scroll lock (ref-counted) ----------

let scrollLockCount = 0;
let savedBodyOverflow = "";
let savedBodyPaddingRight = "";

function lockBodyScroll(): void {
  if (typeof document === "undefined") return;
  scrollLockCount += 1;
  if (scrollLockCount > 1) return;
  const { body } = document;
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  savedBodyOverflow = body.style.overflow;
  savedBodyPaddingRight = body.style.paddingRight;
  body.style.overflow = "hidden";
  if (scrollbarWidth > 0) {
    body.style.paddingRight = `${scrollbarWidth}px`;
  }
}

function unlockBodyScroll(): void {
  if (typeof document === "undefined") return;
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount > 0) return;
  const { body } = document;
  body.style.overflow = savedBodyOverflow;
  body.style.paddingRight = savedBodyPaddingRight;
  savedBodyOverflow = "";
  savedBodyPaddingRight = "";
}

// ---------- Focus helpers ----------

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute("disabled") && el.tabIndex !== -1,
  );
}

// ---------- Root ----------

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
}

export function Dialog({
  open,
  onOpenChange,
  children,
  closeOnEscape = true,
  closeOnBackdrop = true,
}: DialogProps) {
  // Auto-generated titleId — DialogTitle 可覆盖。
  const autoTitleId = useId();
  const [titleId, setTitleId] = useState<string>(autoTitleId);

  const ctx = useMemo<DialogContextValue>(
    () => ({
      open,
      onOpenChange,
      titleId,
      setTitleId,
      ariaLabelledBy: undefined,
      ariaDescribedBy: undefined,
    }),
    [open, onOpenChange, titleId],
  );

  return (
    <DialogContext.Provider value={ctx}>
      {open ? (
        <DialogPortal
          closeOnEscape={closeOnEscape}
          closeOnBackdrop={closeOnBackdrop}
        >
          {children}
        </DialogPortal>
      ) : null}
    </DialogContext.Provider>
  );
}

// ---------- Portal + behavior shell ----------

interface DialogPortalProps {
  children: ReactNode;
  closeOnEscape: boolean;
  closeOnBackdrop: boolean;
}

function DialogPortal({ children, closeOnEscape, closeOnBackdrop }: DialogPortalProps) {
  const { onOpenChange } = useDialogContext("DialogPortal");
  const panelRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  // 记下打开前的焦点宿主，关闭时还回去。
  useLayoutEffect(() => {
    if (typeof document !== "undefined") {
      const active = document.activeElement;
      openerRef.current = active instanceof HTMLElement ? active : null;
    }
    return () => {
      // 关闭后还焦点。requestAnimationFrame 让 portal unmount 先完成。
      const opener = openerRef.current;
      if (opener && typeof opener.focus === "function") {
        requestAnimationFrame(() => {
          opener.focus();
        });
      }
    };
  }, []);

  // Body 滚动锁。
  useEffect(() => {
    lockBodyScroll();
    return () => {
      unlockBodyScroll();
    };
  }, []);

  // 初始焦点：[data-autofocus] 优先，否则首个 focusable，再否则 panel 自身。
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    // requestAnimationFrame 让浏览器渲染后再 focus，避免某些场景下 focus 丢失。
    const raf = requestAnimationFrame(() => {
      const autofocus = panel.querySelector<HTMLElement>("[data-autofocus]");
      if (autofocus) {
        autofocus.focus();
        return;
      }
      const focusables = getFocusable(panel);
      if (focusables.length > 0) {
        focusables[0]?.focus();
      } else {
        panel.focus();
      }
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  // Esc + Tab/Shift+Tab 焦点陷阱。
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && closeOnEscape) {
        e.stopPropagation();
        onOpenChange(false);
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = getFocusable(panel);
      if (focusables.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !panel.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !panel.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [closeOnEscape, onOpenChange]);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onMouseDown={(e) => {
        // 用 mousedown + currentTarget 判断，避免点内容 drag 出来误触发关闭。
        if (!closeOnBackdrop) return;
        if (e.target === e.currentTarget) {
          onOpenChange(false);
        }
      }}
    >
      {/* panelRef 套在 children 的外层包装节点上 —— 让 DialogContent 自己渲 surface。 */}
      <DialogPanelContext.Provider value={panelRef}>
        {children}
      </DialogPanelContext.Provider>
    </div>,
    document.body,
  );
}

// ---------- Panel ref bridge ----------

const DialogPanelContext = createContext<React.MutableRefObject<HTMLDivElement | null> | null>(
  null,
);

function usePanelRef(): React.MutableRefObject<HTMLDivElement | null> {
  const ref = useContext(DialogPanelContext);
  if (!ref) {
    throw new Error("DialogContent must be rendered inside <Dialog>");
  }
  return ref;
}

// ---------- DialogContent ----------

export interface DialogContentProps {
  children: ReactNode;
  className?: string;
  size?: DialogSize;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
}

export function DialogContent({
  children,
  className,
  size = "md",
  ariaLabelledBy,
  ariaDescribedBy,
}: DialogContentProps) {
  const ctx = useDialogContext("DialogContent");
  const panelRef = usePanelRef();

  // 调用方传入的 aria-labelledby 优先；否则用 DialogTitle 注册的 id（context.titleId）。
  const labelledBy = ariaLabelledBy ?? ctx.titleId;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-describedby={ariaDescribedBy}
      tabIndex={-1}
      className={cn(
        "relative flex w-full flex-col rounded-xl border border-border bg-card text-card-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] outline-none",
        "max-h-[90dvh] overflow-hidden",
        DIALOG_SIZES[size],
        className,
      )}
      onMouseDown={(e) => {
        // 阻断 backdrop 的 mousedown 委托，使得在 panel 内拖拽不会关闭。
        e.stopPropagation();
      }}
    >
      {children}
      <DialogCloseButton />
    </div>
  );
}

// ---------- Internal close ✕ button (always rendered top-right) ----------

function DialogCloseButton() {
  const { onOpenChange } = useDialogContext("DialogCloseButton");
  return (
    <div className="pointer-events-none absolute right-2 top-2">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="关闭"
        className="pointer-events-auto"
        onClick={() => onOpenChange(false)}
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}

// ---------- Header / Title / Body / Footer ----------

export interface DialogHeaderProps {
  children: ReactNode;
  className?: string;
}

export function DialogHeader({ children, className }: DialogHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 border-b border-border px-5 py-4 pr-12",
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface DialogTitleProps {
  children: ReactNode;
  className?: string;
  id?: string;
}

export function DialogTitle({ children, className, id }: DialogTitleProps) {
  const ctx = useDialogContext("DialogTitle");
  const autoId = useId();
  const resolvedId = id ?? autoId;

  // 把 title id 注册回 context，让 DialogContent 的 aria-labelledby 默认指向它。
  useLayoutEffect(() => {
    ctx.setTitleId(resolvedId);
  }, [ctx, resolvedId]);

  return (
    <h2
      id={resolvedId}
      className={cn("text-lg font-semibold leading-tight", className)}
    >
      {children}
    </h2>
  );
}

export interface DialogBodyProps {
  children: ReactNode;
  className?: string;
}

export function DialogBody({ children, className }: DialogBodyProps) {
  return (
    <div className={cn("flex-1 overflow-auto px-5 py-4", className)}>{children}</div>
  );
}

export interface DialogFooterProps {
  children: ReactNode;
  className?: string;
}

export function DialogFooter({ children, className }: DialogFooterProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2 border-t border-border px-5 py-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

// ---------- DialogClose (optional helper) ----------

export interface DialogCloseProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  children: ReactNode;
  /** 把 onClick 注入到自定义子节点；要求 children 是单一 ReactElement。 */
  asChild?: boolean;
}

type ClickableElementProps = {
  onClick?: (event: React.MouseEvent<HTMLElement>) => void;
};

export function DialogClose({
  children,
  asChild = false,
  onClick,
  ...rest
}: DialogCloseProps) {
  const { onOpenChange } = useDialogContext("DialogClose");

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      onClick?.(e as React.MouseEvent<HTMLButtonElement>);
      if (!e.defaultPrevented) {
        onOpenChange(false);
      }
    },
    [onClick, onOpenChange],
  );

  if (asChild) {
    const child = children as ReactElement<ClickableElementProps>;
    const childOnClick = child.props.onClick;
    // 仅注入 onClick；外部 rest 不透传给非按钮节点（避免 DOM 报错）。
    return (
      <child.type
        {...child.props}
        onClick={(e: React.MouseEvent<HTMLElement>) => {
          childOnClick?.(e);
          if (!e.defaultPrevented) {
            handleClick(e);
          }
        }}
      />
    );
  }

  return (
    <button type="button" onClick={handleClick} {...rest}>
      {children}
    </button>
  );
}
