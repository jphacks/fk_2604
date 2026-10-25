import { PageShell } from "@/components/layout/page-shell";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <PageShell>
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        {children}
      </main>
    </PageShell>
  );
}
