import { SystemShell } from "@/components/system/SystemShell";

export default function SystemLayout({ children }: { children: React.ReactNode }) {
  return <SystemShell>{children}</SystemShell>;
}
