"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@repo/ui/primitives/dropdown-menu";
import {
  SidebarDropdownMenuContent,
  SidebarDropdownMenuItem,
  SidebarDropdownMenuSeparator,
} from "@repo/ui/composites/sidebar-menu";
import { cn } from "@repo/ui/utils";
import { toast } from "sonner";

import {
  useBlogsQuery,
  useSetActiveBlogMutation,
} from "@/hooks/use-blogs-query";

interface BlogSwitcherProps {
  /** Header menu items (Settings, Log out) rendered below the blog list. */
  footer?: ReactNode;
}

/**
 * Active-blog switcher + header menu for the sidebar. Shows the current blog's
 * display name; for multi-blog users the dropdown lists the caller's blogs and,
 * on select, persists the choice (POST /api/v1/blogs/active) then refreshes so
 * server components re-resolve the tenant. The blog list (and its separator) is
 * only rendered when the user belongs to more than one blog — otherwise the menu
 * shows just the `footer` items.
 */
export function BlogSwitcher({ footer }: BlogSwitcherProps) {
  const { data, isLoading } = useBlogsQuery();
  const setActive = useSetActiveBlogMutation();
  const { refresh } = useRouter();

  const blogs = useMemo(() => data?.blogs ?? [], [data]);
  const activeBlogId = data?.activeBlogId ?? null;

  const current = useMemo(
    () => blogs.find((b) => b.id === activeBlogId) ?? blogs[0],
    [blogs, activeBlogId],
  );

  const handleSelect = useCallback(
    async (blogId: string) => {
      if (blogId === current?.id) return;
      try {
        await setActive.mutateAsync(blogId);
        refresh();
      } catch {
        toast.error("Could not switch blog");
      }
    },
    [setActive, refresh, current?.id],
  );

  const label = isLoading ? "Loading" : (current?.displayName ?? "BlogBat");
  const multiBlog = blogs.length > 1;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1.5 text-[13px] font-semibold tracking-tight text-foreground whitespace-nowrap hover:text-foreground/80 transition-colors outline-none">
          {label}
          <ChevronsUpDown className="size-3 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <SidebarDropdownMenuContent align="start">
        {multiBlog &&
          blogs.map((blog) => (
            <SidebarDropdownMenuItem
              key={blog.id}
              className="cursor-pointer"
              onClick={() => handleSelect(blog.id)}
            >
              <Check
                className={cn(
                  "size-3.5",
                  blog.id === current?.id ? "opacity-100" : "opacity-0",
                )}
              />
              {blog.displayName}
            </SidebarDropdownMenuItem>
          ))}
        {multiBlog && footer && <SidebarDropdownMenuSeparator />}
        {footer}
      </SidebarDropdownMenuContent>
    </DropdownMenu>
  );
}
