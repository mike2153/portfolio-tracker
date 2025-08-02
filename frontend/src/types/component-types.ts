// Component-specific types for Portfolio Tracker UI

import { ReactNode } from 'react';
import { ComponentSize, ComponentVariant } from './utility-types';

// Button component types
export interface ButtonProps {
  children: ReactNode;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit' | 'reset';
  variant?: ComponentVariant;
  size?: ComponentSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

// Input component types
export interface InputProps {
  value: string | number;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  type?: 'text' | 'number' | 'email' | 'password' | 'tel' | 'url' | 'search';
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  error?: string;
  label?: string;
  helperText?: string;
  size?: ComponentSize;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  autoComplete?: string;
  autoFocus?: boolean;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  className?: string;
  style?: React.CSSProperties;
}

// Card component types
export interface CardProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  headerActions?: ReactNode;
  footer?: ReactNode;
  padding?: ComponentSize;
  shadow?: boolean;
  border?: boolean;
  hover?: boolean;
  loading?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
}

// Modal component types
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  size?: ComponentSize;
  closable?: boolean;
  maskClosable?: boolean;
  keyboard?: boolean;
  footer?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

// Tooltip component types
export interface TooltipProps {
  children: ReactNode;
  content: ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  trigger?: 'hover' | 'click' | 'focus';
  delay?: number;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

// Badge component types
export interface BadgeProps {
  children: ReactNode;
  variant?: ComponentVariant;
  size?: ComponentSize;
  dot?: boolean;
  count?: number;
  max?: number;
  showZero?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

// Progress component types
export interface ProgressProps {
  value: number;
  max?: number;
  variant?: ComponentVariant;
  size?: ComponentSize;
  showText?: boolean;
  text?: string;
  animated?: boolean;
  striped?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

// Alert component types
export interface AlertProps {
  children: ReactNode;
  variant?: ComponentVariant;
  closable?: boolean;
  onClose?: () => void;
  icon?: ReactNode;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
}

// Skeleton component types
export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  variant?: 'text' | 'rectangular' | 'circular';
  animation?: 'pulse' | 'wave' | false;
  className?: string;
  style?: React.CSSProperties;
}

// Loading component types
export interface LoadingProps {
  size?: ComponentSize;
  variant?: 'spinner' | 'dots' | 'bars';
  color?: string;
  text?: string;
  overlay?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

// Dropdown component types
export interface DropdownOption {
  label: string;
  value: string | number;
  disabled?: boolean;
  icon?: ReactNode;
  description?: string;
}

export interface DropdownProps {
  options: DropdownOption[];
  value?: string | number;
  onChange: (value: string | number) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  searchable?: boolean;
  clearable?: boolean;
  multiple?: boolean;
  size?: ComponentSize;
  error?: string;
  label?: string;
  helperText?: string;
  className?: string;
  style?: React.CSSProperties;
}

// Tab component types
export interface TabItem {
  key: string;
  label: string;
  content: ReactNode;
  disabled?: boolean;
  icon?: ReactNode;
  closable?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  activeKey?: string;
  onChange: (key: string) => void;
  onTabClose?: (key: string) => void;
  size?: ComponentSize;
  type?: 'line' | 'card' | 'editable-card';
  position?: 'top' | 'right' | 'bottom' | 'left';
  centered?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

// Data display component types
export interface DataDisplayProps {
  label: string;
  value: ReactNode;
  format?: 'currency' | 'percentage' | 'number' | 'date' | 'text';
  precision?: number;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: number;
  loading?: boolean;
  size?: ComponentSize;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
  style?: React.CSSProperties;
}

// Stat card component types
export interface StatCardProps {
  title: string;
  value: string | number;
  format?: 'currency' | 'percentage' | 'number';
  precision?: number;
  change?: number;
  changeFormat?: 'currency' | 'percentage' | 'number';
  changePeriod?: string;
  icon?: ReactNode;
  color?: string;
  loading?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

// Portfolio summary component types
export interface PortfolioSummaryProps {
  totalValue: number;
  dayChange: number;
  dayChangePercent: number;
  totalReturn: number;
  totalReturnPercent: number;
  cashBalance: number;
  loading?: boolean;
  className?: string;
}

// Holdings table component types
export interface HoldingRowData {
  symbol: string;
  name: string;
  quantity: number;
  price: number;
  value: number;
  dayChange: number;
  dayChangePercent: number;
  totalReturn: number;
  totalReturnPercent: number;
  weight: number;
}

export interface HoldingsTableProps {
  holdings: HoldingRowData[];
  loading?: boolean;
  sortBy?: keyof HoldingRowData;
  sortDirection?: 'asc' | 'desc';
  onSort?: (column: keyof HoldingRowData) => void;
  onRowClick?: (holding: HoldingRowData) => void;
  className?: string;
}

// Transaction form component types
export interface TransactionFormData {
  symbol: string;
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  date: string;
  fees?: number;
  notes?: string;
}

export interface TransactionFormProps {
  initialData?: Partial<TransactionFormData>;
  onSubmit: (data: TransactionFormData) => void | Promise<void>;
  onCancel?: () => void;
  loading?: boolean;
  errors?: Record<string, string>;
  className?: string;
}

// Chart container component types
export interface ChartContainerProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  loading?: boolean;
  error?: string;
  height?: string | number;
  controls?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

// Filter panel component types
export interface FilterPanelProps {
  filters: Record<string, unknown>;
  onChange: (filters: Record<string, unknown>) => void;
  onReset: () => void;
  loading?: boolean;
  className?: string;
}

// Search component types
export interface SearchProps {
  value: string;
  onChange: (value: string) => void;
  onSearch?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  clearable?: boolean;
  size?: ComponentSize;
  className?: string;
  style?: React.CSSProperties;
}

// Date picker component types
export interface DatePickerProps {
  value?: string;
  onChange: (date: string) => void;
  format?: string;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  label?: string;
  helperText?: string;
  minDate?: string;
  maxDate?: string;
  size?: ComponentSize;
  className?: string;
  style?: React.CSSProperties;
}

// Navigation component types
export interface NavigationItemData {
  key: string;
  label: string;
  href?: string;
  icon?: ReactNode;
  children?: NavigationItemData[];
  disabled?: boolean;
  active?: boolean;
}

export interface NavigationProps {
  items: NavigationItemData[];
  activeKey?: string;
  onChange?: (key: string) => void;
  collapsed?: boolean;
  onCollapse?: (collapsed: boolean) => void;
  className?: string;
  style?: React.CSSProperties;
}