import { Metadata } from "next";
import AuthCard from "@/components/auth/AuthCard";

export const metadata: Metadata = {
  title: "注册",
};

export default function Signup() {
  return <AuthCard mode="signup" />;
}
