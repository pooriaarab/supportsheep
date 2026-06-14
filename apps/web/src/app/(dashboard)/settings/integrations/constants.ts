import type { DisplaySettings } from "@repo/ui/composites/display-popover";

export const INTEGRATION_GROUPING_OPTIONS = [
  { value: "none", label: "No grouping" },
  { value: "status", label: "Status" },
  { value: "type", label: "Type" },
];

export const INTEGRATION_ORDERING_OPTIONS = [
  { value: "name", label: "Name" },
  { value: "type", label: "Type" },
  { value: "status", label: "Status" },
  { value: "connectedAt", label: "Connected" },
];

export const INTEGRATION_DISPLAY_PROPERTIES = [
  { id: "name", label: "Name" },
  { id: "type", label: "Type" },
  { id: "status", label: "Status" },
  { id: "description", label: "Description" },
  { id: "connectedAt", label: "Connected At" },
];

export const INTEGRATION_DEFAULT_SETTINGS: DisplaySettings = {
  view: "list",
  grouping: "none",
  subGrouping: "none",
  ordering: "name",
  orderDirection: "asc",
  showEmptyGroups: false,
  visibleProperties: new Set([
    "name",
    "type",
    "status",
    "description",
    "connectedAt",
  ]),
};
