"use client";

import { usePathname } from "next/navigation";
import { BankSidebar } from "@/components/bank/BankSidebar";
import { DataBootstrap } from "@/components/layout/DataBootstrap";
import { BankHeader } from "@/components/bank/BankHeader";
import { BankAuthGuard } from "@/components/bank/BankAuthGuard";

export default function BankLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/bank/login") {
    return <div className="min-h-screen bg-emerald-950 text-emerald-50">{children}</div>;
  }
  return (
    <BankAuthGuard>
      <DataBootstrap scope="bank" />
      <div className="flex min-h-screen bg-emerald-50/40">
        <BankSidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          <BankHeader />
          <main className="flex-1 p-5 lg:p-7 bg-emerald-50/30">{children}</main>
        </div>
      </div>
    </BankAuthGuard>
  );
}
