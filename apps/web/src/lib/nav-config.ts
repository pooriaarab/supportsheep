import {
  LayoutDashboard,
  FileText,
  FolderOpen,
  Image,
  Sparkles,
  Blocks,
  Calendar,
  Pen,
  Zap,
  Search,
  Link,
  Map,
  Settings,
  Palette,
  Bot,
  Key,
  Users,
  Upload,
  UserRound,
  Wrench,
  Globe,
  Mic,
  Radio,
  History,
  Plus,
  DollarSign,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: NavItem[];
  exact?: boolean;
  /** When true, shows a "+" icon on hover that triggers the create dialog */
  canCreate?: boolean;
  /** Optional badge count rendered next to the label (e.g. unread count) */
  badge?: number;
}

export interface NavCategory {
  label: string;
  items: NavItem[];
}

/** Main sidebar nav -- bottom section */
export const mainNavItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Posts", href: "/posts", icon: FileText, canCreate: true },
  { label: "Categories", href: "/categories", icon: FolderOpen },
  { label: "Authors", href: "/authors", icon: UserRound },
  { label: "Media", href: "/media", icon: Image },
  {
    label: "Generate",
    href: "/generate",
    icon: Sparkles,
    children: [
      { label: "Keyword to Post", href: "/generate/keyword", icon: Sparkles },
      { label: "Bulk Generate", href: "/generate/bulk", icon: Blocks },
      {
        label: "Content Plans",
        href: "/generate/content-plan",
        icon: Calendar,
      },
      { label: "Templates", href: "/generate/templates", icon: FileText },
    ],
  },
  {
    label: "Writing",
    href: "/writing",
    icon: Pen,
    children: [
      { label: "Skills", href: "/writing/skills", icon: Zap },
      { label: "Context Tags", href: "/writing/context-tags", icon: Pen },
    ],
  },
  {
    label: "SEO",
    href: "/seo",
    icon: Search,
    children: [
      { label: "Internal Links", href: "/seo/internal-links", icon: Link },
      { label: "Sitemaps", href: "/seo/sitemaps", icon: Map },
      { label: "Analytics", href: "/seo/analytics", icon: Search },
    ],
  },
  {
    label: "Interview",
    href: "/interview/links",
    icon: Mic,
    children: [
      { label: "New interview", href: "/interview/new", icon: Plus },
      { label: "Share links", href: "/interview/links", icon: Radio },
      { label: "Sessions", href: "/interview/sessions", icon: History },
      { label: "Live watch", href: "/interview/live-watch", icon: Radio },
      { label: "Spend & Costs", href: "/interview/cost", icon: DollarSign },
    ],
  },
];

/** Settings sidebar -- categorized groups */
export const settingsCategories: NavCategory[] = [
  {
    label: "General",
    items: [
      {
        label: "General",
        href: "/settings/general",
        icon: Settings,
        exact: true,
      },
      { label: "Permalinks", href: "/settings/permalinks", icon: Link },
      { label: "Domain", href: "/settings/domain", icon: Globe },
      { label: "Tools", href: "/settings/tools", icon: Wrench },
      { label: "Theme", href: "/settings/theme", icon: Palette },
      { label: "AI Providers", href: "/settings/ai", icon: Bot },
      { label: "API Keys", href: "/settings/api-keys", icon: Key },
      { label: "Interview", href: "/settings/interview", icon: Mic },
    ],
  },
  {
    label: "Access",
    items: [{ label: "Users", href: "/settings/users", icon: Users }],
  },
  {
    label: "System",
    items: [
      {
        label: "Integrations",
        href: "/settings/integrations",
        icon: Blocks,
      },
      { label: "Functions", href: "/settings/functions", icon: Zap },
      { label: "Import", href: "/settings/import", icon: Upload },
    ],
  },
];

/** Flat list of all settings items (for active-state matching) */
export const settingsNavItems: NavItem[] = settingsCategories.flatMap(
  (c) => c.items,
);

export function flattenNavItems(items: NavItem[]): NavItem[] {
  const flat: NavItem[] = [];
  for (const item of items) {
    flat.push(item);
    if (item.children) flat.push(...item.children);
  }
  return flat;
}
