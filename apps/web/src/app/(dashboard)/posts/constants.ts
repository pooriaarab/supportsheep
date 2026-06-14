import type { DisplaySettings } from "@repo/ui/composites/display-popover";

export const POST_GROUPING_OPTIONS = [
  { value: "none", label: "No grouping" },
  { value: "status", label: "Status" },
  { value: "postType", label: "Post type" },
  { value: "category", label: "Category" },
];

export const POST_ORDERING_OPTIONS = [
  { value: "updatedAt", label: "Updated" },
  { value: "createdAt", label: "Created" },
  { value: "publishedAt", label: "Published" },
  { value: "title", label: "Title" },
  { value: "seoScore", label: "SEO Score" },
];

export const POST_DISPLAY_PROPERTIES = [
  { id: "featuredImage", label: "Image" },
  { id: "title", label: "Title" },
  { id: "status", label: "Status" },
  { id: "indexNow", label: "IndexNow" },
  { id: "postType", label: "Post type" },
  { id: "category", label: "Category" },
  { id: "seoScore", label: "SEO Score" },
  { id: "updatedAt", label: "Updated" },
];

export const POST_DEFAULT_SETTINGS: DisplaySettings = {
  view: "list",
  grouping: "none",
  subGrouping: "none",
  ordering: "updatedAt",
  orderDirection: "desc",
  showEmptyGroups: false,
  visibleProperties: new Set([
    "title",
    "status",
    "indexNow",
    "postType",
    "category",
    "seoScore",
    "updatedAt",
  ]),
};
