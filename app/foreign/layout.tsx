"use client";

import { usePathname } from "next/navigation";
import { ForeignSidebar } from "@/components/foreign/ForeignSidebar";
import { DataBootstrap } from "@/components/layout/DataBootstrap";
import { OpenAccessBanner } from "@/components/layout/OpenAccessBanner";
import { ForeignHeader } from "@/components/foreign/ForeignHeader";
import { ForeignAuthGuard } from "@/components/foreign/ForeignAuthGuard";

const BARE = ["/foreign/register", "/foreign/profile", "/foreign/kyc-waiting"];

export default function ForeignLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (BARE.includes(pathname)) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  return (
    <ForeignAuthGuard>
      <DataBootstrap scope="foreign" />
      <div className="flex min-h-screen bg-background">
        <ForeignSidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          <ForeignHeader />
          <OpenAccessBanner />
          <main className="flex-1 p-5 lg:p-7 bg-muted/30">{children}</main>
        </div>
      </div>
    </ForeignAuthGuard>
  );
}
