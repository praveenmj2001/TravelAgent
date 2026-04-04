import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

export default function AppLayout({
  children,
  userEmail,
}: {
  children: React.ReactNode;
  userEmail: string;
}) {
  return (
    <div
      className="flex min-h-screen dark:from-gray-900 dark:to-gray-800"
      style={{ background: "linear-gradient(135deg, var(--t-app-from) 0%, var(--t-app-mid) 50%, var(--t-app-to) 100%)" }}
    >
      <Sidebar userEmail={userEmail} />
      <div className="flex-1 flex flex-col overflow-auto">
        <TopBar userEmail={userEmail} />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
