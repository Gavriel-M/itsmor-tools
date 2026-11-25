import type { ReactNode } from "react";
import GridBackground from "./GridBackground";
import SiteFooter from "./SiteFooter";
import SiteHeader from "./SiteHeader";

interface PageShellProps {
  children: ReactNode;
}

export default function PageShell({ children }: PageShellProps) {
  return (
    <div className="relative flex flex-col min-h-dvh antialiased selection:bg-terracotta selection:text-background">
      <GridBackground />
      <SiteHeader />
      <main className="relative z-10 flex-1 w-full max-w-screen-xl mx-auto px-4 md:px-8 pt-12 md:pt-24 pb-16 md:pb-24">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
