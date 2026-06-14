import type { Article } from "@repo/types";

type IndexNowStatus = NonNullable<
  NonNullable<Article["submissionStatus"]>["indexNow"]
>["status"];

export function getIndexNowStatusLabel(status?: IndexNowStatus): string {
  switch (status) {
    case "submitted":
      return "Submitted";
    case "failed":
      return "Failed";
    case "pending":
      return "Pending";
    case "not_configured":
    default:
      return "Not configured";
  }
}
