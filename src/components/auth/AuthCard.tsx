"use client";

import { useRouter } from "next/navigation";
import SigninForm from "./SigninForm";
import SignupForm from "./SignupForm";

type AuthMode = "signin" | "signup";

interface AuthCardProps {
  mode: AuthMode;
}

export default function AuthCard({ mode }: AuthCardProps) {
  const router = useRouter();

  return (
    <div className="mx-auto w-full max-w-md px-4">
      {/* App branding */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight">CareerOS</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          用 AI 辅助求职，集中管理每次申请
        </p>
      </div>

      {/* Tab toggle */}
      <div className="mb-6 flex rounded-xl border bg-muted p-1">
        <button
          onClick={() => router.push("/signin")}
          className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all duration-200 ${
            mode === "signin"
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          登录
        </button>
        <button
          onClick={() => router.push("/signup")}
          className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all duration-200 ${
            mode === "signup"
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          注册账号
        </button>
      </div>

      {/* Form card */}
      <div className="rounded-xl border bg-card p-6 shadow-xs">
        {mode === "signin" ? (
          <>
            <div className="mb-5">
              <h2 className="text-xl font-semibold">欢迎回来</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                输入邮箱和密码，登录你的账号
              </p>
            </div>
            <SigninForm />
          </>
        ) : (
          <>
            <div className="mb-5">
              <h2 className="text-xl font-semibold">创建账号</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                注册后即可管理简历、职位和投递进展
              </p>
            </div>
            <SignupForm />
          </>
        )}
      </div>
    </div>
  );
}
