import { redirect } from "next/navigation";
import PoultryDashboard from "@/app/components/poultry-dashboard";
import { isAuthenticated } from "@/lib/session";

export default async function HomePage() {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    redirect("/login");
  }

  return <PoultryDashboard />;
}
