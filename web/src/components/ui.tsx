import { useId, type ReactNode, type ButtonHTMLAttributes } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  AlertCircle,
  ArrowRight,
  BusFront,
  LoaderCircle,
  RefreshCw,
  X,
  type LucideIcon,
} from "lucide-react";
export function Button({
  children,
  variant = "primary",
  busy = false,
  className = "",
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      {...p}
      disabled={p.disabled || busy}
      className={`button button-${variant} ${className}`}
    >
      {busy && <LoaderCircle size={17} className="spin" />}
      {children}
    </button>
  );
}
export function IconButton({
  icon: Icon,
  label,
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <button
      type="button"
      {...p}
      className={`icon-button ${p.className || ""}`}
      aria-label={label}
      title={label}
    >
      <Icon size={19} />
    </button>
  );
}
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide = false,
  className = "",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className={`dialog-content ${wide ? "dialog-wide" : ""} ${className}`}
          aria-describedby={description ? id : undefined}
        >
          <div className="dialog-top">
            <div>
              <Dialog.Title className="dialog-title">{title}</Dialog.Title>
              {description && (
                <Dialog.Description id={id} className="muted">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <IconButton icon={X} label="Đóng hộp thoại" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {children && <div className="heading-actions">{children}</div>}
    </div>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
export function Empty({
  icon: Icon = BusFront,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={28} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: Error;
  retry: () => unknown;
}) {
  return (
    <div role="alert" className="error-state">
      <AlertCircle size={24} />
      <div>
        <h3>Chưa tải được dữ liệu</h3>
        <p>{error.message}</p>
      </div>
      <Button variant="secondary" onClick={() => retry()}>
        <RefreshCw size={16} />
        Thử lại
      </Button>
    </div>
  );
}
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}
export function CardSkeletons({ count = 3 }: { count?: number }) {
  return (
    <div className="card-grid" aria-label="Đang tải dữ liệu" aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <div className="surface skeleton-card" key={i}>
          <Skeleton className="skeleton-image" />
          <Skeleton />
          <Skeleton className="skeleton-short" />
        </div>
      ))}
    </div>
  );
}
export function SectionTitle({
  title,
  subtitle,
  to,
  onClick,
}: {
  title: string;
  subtitle?: string;
  to?: string;
  onClick?: () => void;
}) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {onClick && (
        <Button variant="ghost" onClick={onClick}>
          {to || "Xem tất cả"}
          <ArrowRight size={16} />
        </Button>
      )}
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small className="muted">{hint}</small>}
    </label>
  );
}
export function Busy({ text = "Đang tải dữ liệu…" }: { text?: string }) {
  return (
    <div className="busy-line" role="status">
      <LoaderCircle size={19} className="spin" />
      {text}
    </div>
  );
}
