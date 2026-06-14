/**
 * Centralized query key factory for TanStack Query
 * Ensures consistent, hierarchical query keys across the app
 *
 * Usage with TanStack Query:
 * ```typescript
 * const { data } = useQuery({
 *   queryKey: queryKeys.users.list(),
 *   queryFn: () => fetchUsers(),
 * });
 *
 * // Invalidate all user queries
 * queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
 *
 * // Invalidate a specific user
 * queryClient.invalidateQueries({ queryKey: queryKeys.users.detail("user-123") });
 * ```
 */

export const queryKeys = {
  users: {
    all: ["users"] as const,
    lists: () => [...queryKeys.users.all, "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.users.lists(), filters] as const,
    details: () => [...queryKeys.users.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.users.details(), id] as const,
  },
  items: {
    all: ["items"] as const,
    lists: () => [...queryKeys.items.all, "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.items.lists(), filters] as const,
    details: () => [...queryKeys.items.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.items.details(), id] as const,
  },
  settings: {
    all: ["settings"] as const,
    general: () => [...queryKeys.settings.all, "general"] as const,
    detail: (key: string) => [...queryKeys.settings.all, key] as const,
  },
  integrations: {
    all: ["integrations"] as const,
    lists: () => [...queryKeys.integrations.all, "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.integrations.lists(), filters] as const,
    details: () => [...queryKeys.integrations.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.integrations.details(), id] as const,
  },
  tasks: {
    all: ["tasks"] as const,
    lists: () => [...queryKeys.tasks.all, "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.tasks.lists(), filters] as const,
    details: () => [...queryKeys.tasks.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.tasks.details(), id] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    lists: () => [...queryKeys.notifications.all, "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.notifications.lists(), filters] as const,
  },
  apiKeys: {
    all: ["apiKeys"] as const,
    lists: () => [...queryKeys.apiKeys.all, "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.apiKeys.lists(), filters] as const,
  },
  auditLogs: {
    all: ["auditLogs"] as const,
    lists: () => [...queryKeys.auditLogs.all, "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.auditLogs.lists(), filters] as const,
  },
  templates: {
    all: ["templates"] as const,
    lists: () => [...queryKeys.templates.all, "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.templates.lists(), filters] as const,
    details: () => [...queryKeys.templates.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.templates.details(), id] as const,
  },
  aiChatThreads: {
    all: ["aiChatThreads"] as const,
    lists: () => [...queryKeys.aiChatThreads.all, "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.aiChatThreads.lists(), filters] as const,
  },
  articles: {
    all: ["articles"] as const,
    lists: () => [...queryKeys.articles.all, "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.articles.lists(), filters] as const,
    details: () => [...queryKeys.articles.all, "detail"] as const,
    detail: (slug: string) => [...queryKeys.articles.details(), slug] as const,
  },
  categories: {
    all: ["categories"] as const,
    lists: () => [...queryKeys.categories.all, "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.categories.lists(), filters] as const,
  },
  authors: {
    all: ["authors"] as const,
    lists: () => [...queryKeys.authors.all, "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.authors.lists(), filters] as const,
    details: () => [...queryKeys.authors.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.authors.details(), id] as const,
  },
  media: {
    all: ["media"] as const,
    lists: () => [...queryKeys.media.all, "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.media.lists(), filters] as const,
    details: () => [...queryKeys.media.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.media.details(), id] as const,
  },
  health: {
    all: ["health"] as const,
    status: () => [...queryKeys.health.all, "status"] as const,
  },
  contextTags: {
    all: ["contextTags"] as const,
    lists: () => [...queryKeys.contextTags.all, "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.contextTags.lists(), filters] as const,
    details: () => [...queryKeys.contextTags.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.contextTags.details(), id] as const,
  },
  contentPlans: {
    all: ["contentPlans"] as const,
    lists: () => [...queryKeys.contentPlans.all, "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.contentPlans.lists(), filters] as const,
    details: () => [...queryKeys.contentPlans.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.contentPlans.details(), id] as const,
  },
  writingSkills: {
    all: ["writingSkills"] as const,
    lists: () => [...queryKeys.writingSkills.all, "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.writingSkills.lists(), filters] as const,
    details: () => [...queryKeys.writingSkills.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.writingSkills.details(), id] as const,
  },
  internalLinkRules: {
    all: ["internalLinkRules"] as const,
    lists: () => [...queryKeys.internalLinkRules.all, "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.internalLinkRules.lists(), filters] as const,
  },
  sitemaps: {
    all: ["sitemaps"] as const,
    lists: () => [...queryKeys.sitemaps.all, "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.sitemaps.lists(), filters] as const,
    details: () => [...queryKeys.sitemaps.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.sitemaps.details(), id] as const,
  },
  freeTools: {
    all: ["freeTools"] as const,
    lists: () => [...queryKeys.freeTools.all, "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.freeTools.lists(), filters] as const,
    details: () => [...queryKeys.freeTools.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.freeTools.details(), id] as const,
  },
  blogConfig: {
    all: ["blogConfig"] as const,
    settings: () => [...queryKeys.blogConfig.all, "settings"] as const,
  },
  functions: {
    all: ["functions"] as const,
    lists: () => [...queryKeys.functions.all, "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.functions.lists(), filters] as const,
  },
  imports: {
    all: ["imports"] as const,
    lists: () => [...queryKeys.imports.all, "list"] as const,
    detail: (id: string) => [...queryKeys.imports.all, "detail", id] as const,
  },
  blogs: {
    all: ["blogs"] as const,
    lists: () => [...queryKeys.blogs.all, "list"] as const,
  },
  domain: {
    all: ["domain"] as const,
    detail: (blogId: string) => [...queryKeys.domain.all, blogId] as const,
  },
  domainWaitlist: {
    all: ["domainWaitlist"] as const,
    detail: (blogId: string) =>
      [...queryKeys.domainWaitlist.all, blogId] as const,
  },
} as const;
