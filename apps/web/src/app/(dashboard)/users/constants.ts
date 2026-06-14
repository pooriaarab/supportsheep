import type { DisplaySettings } from "@repo/ui/composites/display-popover";

export const USER_GROUPING_OPTIONS = [
  { value: "none", label: "No grouping" },
  { value: "role", label: "Role" },
  { value: "status", label: "Status" },
];

export const USER_ORDERING_OPTIONS = [
  { value: "name", label: "Name" },
  { value: "email", label: "Email" },
  { value: "role", label: "Role" },
  { value: "status", label: "Status" },
  { value: "joinedAt", label: "Joined" },
];

export const USER_DISPLAY_PROPERTIES = [
  { id: "name", label: "Name" },
  { id: "email", label: "Email" },
  { id: "role", label: "Role" },
  { id: "status", label: "Status" },
  { id: "joinedAt", label: "Joined" },
];

export const USER_DEFAULT_SETTINGS: DisplaySettings = {
  view: "list",
  grouping: "none",
  subGrouping: "none",
  ordering: "joinedAt",
  orderDirection: "desc",
  showEmptyGroups: false,
  visibleProperties: new Set(["name", "role", "status", "joinedAt"]),
};
