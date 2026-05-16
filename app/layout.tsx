import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { TrickStoreProvider } from "@/lib/store/TrickStore";
import { ExternalLinkHandler } from "@/components/ExternalLinkHandler";
import { LastVisitedTracker } from "@/components/LastVisitedTracker";
import { UpdateChecker } from "@/components/UpdateChecker";

export const metadata: Metadata = {
  title: "Trick Cards",
  description: "Structured trick cards for reusable technical knowledge."
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <ExternalLinkHandler />
        <LastVisitedTracker />
        <TrickStoreProvider>{children}</TrickStoreProvider>
        <UpdateChecker />
      </body>
    </html>
  );
}
