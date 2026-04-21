import { redirect } from "next/navigation";
import LoginForm from "@/app/components/login-form";
import { isAuthenticated } from "@/lib/session";

export default async function LoginPage() {
  const authenticated = await isAuthenticated();

  if (authenticated) {
    redirect("/");
  }

  return <LoginForm />;
}
