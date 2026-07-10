import type { Metadata } from "next";
import Sidebar from "@/components/app/Sidebar";
import TopBar from "@/components/app/TopBar";
import Toaster from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: "NetChain, Demo App",
};

/**
 * App chrome: top bar (party switcher + balance) and side navigation.
 * Everything below re-scopes when the logged-in party changes.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar />
      <div className="flex flex-1 flex-col lg:flex-row">
        <Sidebar />
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
      <Toaster />
    </div>
  );
}
