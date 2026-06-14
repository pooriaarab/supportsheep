import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to manage BlogBat content and settings.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return <LoginForm />;
}
