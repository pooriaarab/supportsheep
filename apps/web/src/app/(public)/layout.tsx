import { getBlogConfig } from "@/lib/blog-config";
import { PublicShell } from "@/components/public/shell";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const config = await getBlogConfig();

  return (
    <PublicShell config={config} isHomepage={false}>
      {children}
    </PublicShell>
  );
}
