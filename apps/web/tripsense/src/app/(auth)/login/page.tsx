"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth, UserRole } from "@/features/auth";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!email.trim() || !email.includes("@")) {
      setErrorMsg("Vui lòng nhập địa chỉ email hợp lệ");
      return;
    }
    if (!password) {
      setErrorMsg("Vui lòng nhập mật khẩu");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const response = await login({ email: email.trim(), password });
      const loggedInRole = response.data?.user?.role;
      if (loggedInRole === UserRole.ADMIN) {
        router.replace("/admin");
      } else {
        router.replace("/explore");
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Thông tin đăng nhập không chính xác. Vui lòng thử lại.";
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-xl text-card-foreground">
      <div className="flex flex-col items-center text-center space-y-2 mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
          Đăng nhập vào TripSense
        </h1>
        <p className="text-xs text-muted-foreground">
          Khám phá lịch trình du lịch thông minh cùng trợ lý AI
        </p>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="mb-4 w-full text-xs font-medium text-destructive bg-destructive/10 border border-destructive/20 p-3 rounded-xl"
        >
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="login-email"
            className="text-xs font-medium text-muted-foreground"
          >
            Email
          </label>
          <Input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ban@example.com"
            autoComplete="email"
            disabled={loading}
            className="h-11 rounded-xl px-3.5 text-sm"
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="login-password"
              className="text-xs font-medium text-muted-foreground"
            >
              Mật khẩu
            </label>
          </div>
          <Input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            disabled={loading}
            className="h-11 rounded-xl px-3.5 text-sm"
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          loading={loading}
          loadingText="Đang đăng nhập..."
          className="w-full h-11 rounded-xl font-semibold text-sm shadow-sm mt-2"
        >
          Đăng nhập
        </Button>
      </form>

      <div className="mt-6 text-center text-xs text-muted-foreground">
        Chưa có tài khoản?{" "}
        <Link
          href="/register"
          className="font-semibold text-primary hover:underline underline-offset-4"
        >
          Đăng ký ngay
        </Link>
      </div>
    </div>
  );
}
