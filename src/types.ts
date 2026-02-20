export interface StackFrame {
  filename: string;
  function: string;
  lineno: number;
  colno?: number;
  context_line?: string;
  pre_context?: string[];
  post_context?: string[];
  in_app?: boolean;
}

export interface Breadcrumb {
  type: "console" | "click" | "navigation" | "fetch" | "custom";
  category?: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

export interface BreadcrumbOptions {
  console?: boolean;
  clicks?: boolean;
  navigation?: boolean;
  fetch?: boolean;
}

export interface BoobooUser {
  id?: string;
  email?: string;
  username?: string;
  ip_address?: string;
  [key: string]: unknown;
}

export interface BoobooOptions {
  dsn: string;
  endpoint?: string;
  breadcrumbs?: boolean | BreadcrumbOptions;
  maxBreadcrumbs?: number;
  beforeSend?: (event: BoobooEvent) => BoobooEvent | null;
  tags?: Record<string, string>;
  context?: Record<string, unknown>;
  user?: BoobooUser;
}

export interface BoobooEvent {
  message: string;
  level: "error" | "warning" | "info";
  exception_type: string;
  stacktrace: StackFrame[];
  context: Record<string, unknown>;
  request: {
    url: string;
    headers: Record<string, string>;
  };
  tags: Record<string, string>;
}
