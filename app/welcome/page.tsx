import { auth } from "@/auth";
import { redirect } from "next/navigation";
import SignOutButton from "@/app/welcome/SignOutButton";
import BackendGreeting from "@/app/welcome/BackendGreeting";
import AppLayout from "@/app/components/AppLayout";

export default async function WelcomePage() {
  const session = await auth();
  if (!session) redirect("/signin");

  const user = session.user!;
  const userEmail = user.email ?? "";

  return (
    <AppLayout userEmail={userEmail}>
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-10 flex flex-col items-center gap-6 w-full max-w-sm text-center">
          {user.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt={user.name ?? "avatar"}
              className="w-20 h-20 rounded-full border-4 border-indigo-200"
            />
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
              Welcome, {user.name}!
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{user.email}</p>
          </div>
          <BackendGreeting idToken={(session as any).idToken} />
          <SignOutButton />
        </div>
      </div>
    </AppLayout>
  );
}
