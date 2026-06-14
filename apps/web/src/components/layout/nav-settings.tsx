"use client";

import { settingsCategories } from "@/lib/nav-config";
import { SidebarNavItem } from "./nav-main";

interface NavSettingsProps {
  collapsed?: boolean;
}

export function NavSettings({ collapsed = false }: NavSettingsProps) {
  return (
    <nav className="flex-1 px-1.5 py-2 overflow-y-auto">
      <div className="flex flex-col gap-4">
        {settingsCategories.map((category) => (
          <div key={category.label}>
            {!collapsed && (
              <div className="px-2.5 pb-1">
                <span className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">
                  {category.label}
                </span>
              </div>
            )}
            <div className="flex flex-col gap-px">
              {category.items.map((item) => (
                <SidebarNavItem
                  key={item.href}
                  item={item}
                  collapsed={collapsed}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}
