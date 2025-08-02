// Utility types for Portfolio Tracker

export type StringOrNumber = string | number;
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type NullableOptional<T> = T | null | undefined;

// Generic utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type PartialFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Event handler types
export type EventHandler<T = void> = () => T;
export type EventHandlerWithPayload<P, T = void> = (payload: P) => T;
export type AsyncEventHandler<T = void> = () => Promise<T>;
export type AsyncEventHandlerWithPayload<P, T = void> = (payload: P) => Promise<T>;

// DOM event types
export type ClickEventHandler = (event: React.MouseEvent<HTMLElement>) => void;
export type ChangeEventHandler<T = HTMLInputElement> = (event: React.ChangeEvent<T>) => void;
export type SubmitEventHandler = (event: React.FormEvent<HTMLFormElement>) => void;
export type KeyboardEventHandler = (event: React.KeyboardEvent<HTMLElement>) => void;

// Form-related types
export interface FormErrors {
  [key: string]: string | undefined;
}

export interface FormTouched {
  [key: string]: boolean | undefined;
}

export interface FormState<T> {
  values: T;
  errors: FormErrors;
  touched: FormTouched;
  isSubmitting: boolean;
  isValid: boolean;
}

// API response wrapper types
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  timestamp: string;
}

export interface ApiError {
  message: string;
  code?: string | number;
  details?: Record<string, unknown>;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// Loading and status types
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';
export type SortDirection = 'asc' | 'desc';
export type ViewMode = 'list' | 'grid' | 'chart';

export interface LoadingStatus {
  isLoading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

// Component prop utilities
export type ComponentSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type ComponentVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
export type ComponentPosition = 'top' | 'bottom' | 'left' | 'right' | 'center';

// Theme-related types
export interface ThemeColors {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
}

export interface ThemeSpacing {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
}

export interface ThemeBorderRadius {
  none: string;
  sm: string;
  md: string;
  lg: string;
  full: string;
}

// Filter and search types
export interface FilterOption<T = string> {
  label: string;
  value: T;
  disabled?: boolean;
}

export interface SearchParams {
  query: string;
  filters: Record<string, unknown>;
  sortBy: string;
  sortDirection: SortDirection;
  page: number;
  pageSize: number;
}

// Time-related types
export type TimeRange = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'YTD' | 'ALL';
export type DateFormat = 'YYYY-MM-DD' | 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD HH:mm:ss';

export interface DateRange {
  start: string;
  end: string;
}

// File and upload types
export interface FileUpload {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  url?: string;
}

// Validation types
export type ValidationRule<T> = (value: T) => string | undefined;
export type ValidationRules<T> = {
  [K in keyof T]?: ValidationRule<T[K]>[];
};

// Cache types
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export type CacheKey = string | number;

// Navigation types
export interface NavigationItem {
  label: string;
  href: string;
  icon?: string;
  disabled?: boolean;
  children?: NavigationItem[];
}

// Modal and dialog types
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: ComponentSize;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
}

// Table types
export interface TableColumn<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (value: T[keyof T], row: T) => React.ReactNode;
}

export interface TableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  loading?: boolean;
  sortBy?: keyof T;
  sortDirection?: SortDirection;
  onSort?: (column: keyof T) => void;
  onRowClick?: (row: T) => void;
  selectedRows?: T[];
  onRowSelect?: (rows: T[]) => void;
}

// Dropdown and select types
export interface SelectOption<T = string> {
  label: string;
  value: T;
  disabled?: boolean;
  group?: string;
}

export interface SelectProps<T> {
  options: SelectOption<T>[];
  value?: T;
  onChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
  multiple?: boolean;
  searchable?: boolean;
  clearable?: boolean;
}