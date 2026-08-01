import { Sidebar } from "@/components/layout/Sidebar";
import { DataBootstrap } from "@/components/layout/DataBootstrap";
import { Header } from "@/components/layout/Header";
import { UserAuthGuard } from "@/components/layout/AuthGuard";

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserAuthGuard>
      <DataBootstrap scope="user" />
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          <Header />
          <main className="flex-1 p-5 lg:p-7">{children}</main>
        </div>
      </div>
    </UserAuthGuard>
  );
}
