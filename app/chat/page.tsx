import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AppLayout from "@/app/components/AppLayout";
import ChatClient from "./ChatClient";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; prompt?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/signin");

  const { id, prompt } = await searchParams;
  const userEmail = session.user?.email ?? "";

  return (
    <AppLayout userEmail={userEmail}>
      <ChatClient userEmail={userEmail} conversationId={id} autoPrompt={prompt} />
    </AppLayout>
  );
}
