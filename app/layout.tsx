import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { SessionBootstrap } from "@/components/layout/DataBootstrap";
import "./globals.css";

const vazirmatn = Vazirmatn({
  variable: "--font-vazirmatn",
  subsets: ["arabic", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AFA — درگاه پرداخت ارزی",
  description: "سامانه پرداخت ارزی منطقه آزاد",
  icons: { icon: "/afa-logo.png" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa-IR" dir="rtl" className={`${vazirmatn.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground">
        <ThemeProvider>
          <SessionBootstrap />
          {children}
        </ThemeProvider>
        <Toaster
          position="top-left"
          toastOptions={{
            style: { fontFamily: "var(--font-vazirmatn)" },
          }}
          dir="rtl"
          richColors
        />
      </body>
    </html>
  );
}
