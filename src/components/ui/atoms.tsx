import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

/* ---------------- Card / Inset ---------------- */
type DivProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className = '', children, ...rest }: DivProps) {
  return (
    <div className={`card ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function Inset({ className = '', children, ...rest }: DivProps) {
  return (
    <div className={`inset ${className}`} {...rest}>
      {children}
    </div>
  );
}

/* ---------------- Btn ---------------- */
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type BtnSize = 'sm' | 'md' | 'lg';

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: BtnSize;
}

export function Btn({
  variant = 'secondary',
  size = 'md',
  className = '',
  children,
  ...rest
}: BtnProps) {
  const sizeCls = size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : '';
  return (
    <button
      className={`btn btn-${variant} ${sizeCls} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------------- Chip ---------------- */
type ChipVariant = 'default' | 'strong' | 'accent' | 'success' | 'danger' | 'mono';
interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: ChipVariant;
  mono?: boolean;
}

export function Chip({
  variant = 'default',
  mono = false,
  className = '',
  children,
  ...rest
}: ChipProps) {
  const variantCls =
    variant === 'strong' ? 'chip-strong'
    : variant === 'accent' ? 'chip-accent'
    : variant === 'success' ? 'chip-success'
    : variant === 'danger' ? 'chip-danger'
    : variant === 'mono' ? 'chip-mono chip-strong'
    : '';
  const monoCls = mono && variant !== 'mono' ? 'chip-mono' : '';
  return (
    <span className={`chip ${variantCls} ${monoCls} ${className}`.trim()} {...rest}>
      {children}
    </span>
  );
}

/* ---------------- MoveChip ---------------- */
interface MoveChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  san: string;
  ply?: number | string;
  mainline?: boolean;
  hasChapter?: boolean;
  selected?: boolean;
  minor?: boolean;
}

export function MoveChip({
  san,
  ply,
  mainline = false,
  hasChapter = false,
  selected = false,
  minor = false,
  className = '',
  ...rest
}: MoveChipProps) {
  const cls =
    `movechip ${minor ? 'minor' : ''} ${selected ? 'selected' : ''} ` +
    `${mainline ? 'mainline' : ''} ${hasChapter ? 'has-chapter' : ''} ${className}`;
  return (
    <button type="button" className={cls.replace(/\s+/g, ' ').trim()} {...rest}>
      {mainline && <span className="star" style={{ color: 'var(--accent)', fontSize: '10px' }}>★</span>}
      {ply !== undefined && <span className="ply">{ply}</span>}
      <span className="san">{san}</span>
    </button>
  );
}

/* ---------------- Avatar ---------------- */
interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  name: string;
  size?: 'sm' | 'lg' | 'xl';
}

export function avatarInitials(name: string): string {
  if (!name) return '?';
  return name
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function Avatar({ name, size = 'sm', className = '', ...rest }: AvatarProps) {
  const sizeCls = size === 'lg' ? 'avatar-lg' : size === 'xl' ? 'avatar-xl' : '';
  return (
    <div className={`avatar ${sizeCls} ${className}`.trim()} {...rest}>
      {avatarInitials(name)}
    </div>
  );
}

/* ---------------- Segmented ---------------- */
interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  count?: number | string;
}
interface SegmentedProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: SegmentedOption<T>[];
  accent?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  accent = false,
  className = '',
  ariaLabel,
}: SegmentedProps<T>) {
  return (
    <div
      className={`segmented ${accent ? 'accent' : ''} ${className}`.trim()}
      role={ariaLabel ? 'group' : undefined}
      aria-label={ariaLabel}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={value === o.value ? 'active' : ''}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
        >
          {o.label}
          {o.count != null && <span className="num">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Breadcrumbs (Crumbs) ---------------- */
export interface CrumbItem {
  key: string | number;
  label: ReactNode;
  plyNum?: ReactNode;
  current?: boolean;
  onClick?: () => void;
}

export function Crumbs({
  items,
  rootLabel,
  onRootClick,
  rootActive,
}: {
  items: CrumbItem[];
  rootLabel?: ReactNode;
  onRootClick?: () => void;
  rootActive?: boolean;
}) {
  return (
    <div className="crumbs">
      {rootLabel !== undefined && (
        <button
          type="button"
          onClick={onRootClick}
          className={rootActive ? 'current' : ''}
        >
          {rootLabel}
        </button>
      )}
      {items.map((c, i) => (
        <span key={c.key} style={{ display: 'inline-flex', alignItems: 'center' }}>
          {(rootLabel !== undefined || i > 0) && <span className="sep">›</span>}
          <button
            type="button"
            onClick={c.onClick}
            className={c.current ? 'current' : ''}
          >
            {c.plyNum && <span className="ply-num">{c.plyNum}</span>}
            {c.label}
          </button>
        </span>
      ))}
    </div>
  );
}

/* ---------------- ProgressBar ---------------- */
export function ProgressBar({
  pct,
  height = 4,
  className = '',
}: {
  pct: number;
  height?: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className={`bar ${className}`.trim()} style={{ height }}>
      <span style={{ width: `${clamped}%` }} />
    </div>
  );
}

/* ---------------- Kbd ---------------- */
export function Kbd({ children }: { children: ReactNode }) {
  return <span className="kbd">{children}</span>;
}

/* ---------------- TurnDot ---------------- */
export function TurnDot({ side }: { side: 'w' | 'b' }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 12,
        height: 12,
        borderRadius: 999,
        background: side === 'w' ? '#f8fafc' : '#18181b',
        boxShadow: side === 'w'
          ? '0 0 0 1px rgba(255,255,255,0.2)'
          : '0 0 0 1px #e7e7eb',
        flexShrink: 0,
      }}
    />
  );
}
