import { redirect } from "next/navigation";

/**
 * /generate -- redirects to the default generation page.
 */
export default function GeneratePage() {
  redirect("/generate/keyword");
}
