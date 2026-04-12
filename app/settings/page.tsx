import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AppLayout from "@/app/components/AppLayout";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const session = await auth();
  if (!session) redirect("/signin");

  const user = session.user!;
  const userEmail = user.email ?? "";

  return (
    <AppLayout userEmail={userEmail} userImage={user.image ?? ""} userName={user.name ?? ""}>
      <SettingsClient
        userEmail={userEmail}
        userName={user.name ?? ""}
        userImage={user.image ?? ""}
      />
    </AppLayout>
  );
}
