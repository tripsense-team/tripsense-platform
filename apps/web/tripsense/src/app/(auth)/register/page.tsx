"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState("");
  const [successMsg, setSuccessMsg] = React.useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!email.trim() || !email.includes("@")) {
      setErrorMsg("Vui lòng nhập địa chỉ email hợp lệ");
      return;
    }
    if (!password || password.length < 6) {
      setErrorMsg("Mật khẩu phải có ít nhất 6 ký tự");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("Mật khẩu xác nhận không khớp");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      await register({ email: email.trim(), password });
      setSuccessMsg("Đăng ký thành công! Đang chuyển hướng sang đăng nhập...");
      setTimeout(() => {
        router.replace("/login");
      }, 1200);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Đăng ký không thành công. Email có thể đã được sử dụng.";
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-xl text-card-foreground">
      <div className="flex flex-col items-center text-center space-y-2 mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
          Tạo tài khoản TripSense
        </h1>
        <p className="text-xs text-muted-foreground">
          Bắt đầu hành trình khám phá và lập kế hoạch du lịch dễ dàng
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

      {successMsg && (
        <div
          role="status"
          className="mb-4 w-full text-xs font-medium text-primary bg-primary/10 border border-primary/20 p-3 rounded-xl"
        >
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="register-email"
            className="text-xs font-medium text-muted-foreground"
          >
            Email
          </label>
          <Input
            id="register-email"
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
          <label
            htmlFor="register-password"
            className="text-xs font-medium text-muted-foreground"
          >
            Mật khẩu
          </label>
          <Input
            id="register-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Tối thiểu 6 ký tự"
            autoComplete="new-password"
            disabled={loading}
            className="h-11 rounded-xl px-3.5 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="register-confirm-password"
            className="text-xs font-medium text-muted-foreground"
          >
            Xác nhận mật khẩu
          </label>
          <Input
            id="register-confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Nhập lại mật khẩu"
            autoComplete="new-password"
            disabled={loading}
            className="h-11 rounded-xl px-3.5 text-sm"
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          loading={loading}
          loadingText="Đang tạo tài khoản..."
          className="w-full h-11 rounded-xl font-semibold text-sm shadow-sm mt-2"
        >
          Đăng ký tài khoản
        </Button>
      </form>

      <div className="mt-6 text-center text-xs text-muted-foreground">
        Đã có tài khoản?{" "}
        <Link
          href="/login"
          className="font-semibold text-primary hover:underline underline-offset-4"
        >
          Đăng nhập
        </Link>
      </div>
    </div>
  );
}
