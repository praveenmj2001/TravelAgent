import { auth } from "@/auth";
import { redirect } from "next/navigation";
import LandingPage from "@/app/components/LandingPage";

export default async function Home() {
  const session = await auth();
  if (session) {
    redirect("/welcome");
  }
  return <LandingPage />;
}
