"use client";

import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { DataBootstrap } from "@/components/layout/DataBootstrap";
import { OpenAccessBanner } from "@/components/layout/OpenAccessBanner";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminAuthGuard } from "@/components/layout/AuthGuard";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthGuard>
      <DataBootstrap scope="admin" />
      <div className="flex min-h-screen bg-slate-100">
        <AdminSidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          <AdminHeader />
          <OpenAccessBanner />
          <main className="flex-1 p-5 lg:p-7 bg-slate-50">{children}</main>
        </div>
      </div>
    </AdminAuthGuard>
  );
}
