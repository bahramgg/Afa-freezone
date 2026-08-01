import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { UserAuthGuard } from "@/components/layout/AuthGuard";

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserAuthGuard>
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
