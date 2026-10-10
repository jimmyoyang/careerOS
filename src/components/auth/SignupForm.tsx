"use client";
import { zhMessage } from "@/lib/i18n/zh-CN";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { signup, authenticate } from "@/actions/auth.actions";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SignupFormSchema } from "@/models/signupForm.schema";
import Loading from "../Loading";
import { Eye, EyeOff } from "lucide-react";

function SignupForm() {
  const [isPending, startTransition] = useTransition();

  const form = useForm<z.infer<typeof SignupFormSchema>>({
    resolver: zodResolver(SignupFormSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  const [errorMessage, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const onSubmit = async (data: z.infer<typeof SignupFormSchema>) => {
    startTransition(async () => {
      setError("");
      const result = await signup(data);
      if (result.error) {
        setError(result.error);
        return;
      }
      const formData = new FormData();
      formData.set("email", data.email);
      formData.set("password", data.password);
      const authError = await authenticate("", formData);
      if (authError) {
        setError(authError);
      } else {
        router.push("/dashboard");
      }
    });
  };

  return (
    <Form {...form}>
      <form method="POST" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>姓名</FormLabel>
                  <FormControl>
                    <Input placeholder="请输入姓名" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid gap-2">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>邮箱</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="id@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid gap-2">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>密码</FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        spellCheck={false}
                        autoCorrect="off"
                        autoCapitalize="off"
                        {...field}
                      />
                    </FormControl>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 text-muted-foreground"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={
                        showPassword ? "隐藏密码" : "显示密码"
                      }
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? <Loading /> : "注册账号"}
          </Button>
          <div
            className="flex h-8 items-end space-x-1"
            aria-live="polite"
            aria-atomic="true"
          >
            {errorMessage && (
              <p className="text-sm text-red-500">{zhMessage(errorMessage)}</p>
            )}
          </div>
        </div>
      </form>
    </Form>
  );
}

export default SignupForm;
