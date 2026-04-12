import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AppLayout from "@/app/components/AppLayout";
import AskClient from "./AskClient";

export default async function AskPage() {
  const session = await auth();
  if (!session) redirect("/signin");

  const userEmail = session.user?.email ?? "";
  const userImage = session.user?.image ?? "";
  const userName = session.user?.name ?? "";

  return (
    <AppLayout userEmail={userEmail} userImage={userImage} userName={userName}>
      <AskClient userEmail={userEmail} />
    </AppLayout>
  );
}
