import type { ReactNode } from "react";

/**
 * Represents a filter option in the add-filter dropdown.
 */
export interface FilterItem {
  id: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
}
