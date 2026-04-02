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
    <div className="flex min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <Sidebar userEmail={userEmail} />
      <div className="flex-1 flex flex-col overflow-auto">
        <TopBar userEmail={userEmail} />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
