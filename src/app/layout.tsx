import type { Metadata } from "next";
import "./globals.css";
import { ClientLayout } from "@/components/ClientLayout";

export const metadata: Metadata = {
  title: "AWS OpsConsole — Cloud Observability",
  description: "Production-grade read-only AWS monitoring dashboard",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased h-screen overflow-hidden flex">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
