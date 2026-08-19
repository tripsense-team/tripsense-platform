"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OtpInput } from "./otp-input";
import { siteConfig } from "@/config/site";
import { useAuth } from "../context/auth-context";
import { UserRole, type AuthModalStep } from "../types";
import { cn } from "@/lib/utils";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMode?: "signin" | "signup";
}

export function AuthModal({ open, onOpenChange, initialMode = "signin" }: AuthModalProps) {
  const router = useRouter();
  const { login, register, verifyEmail, resendCode } = useAuth();

  const [mode, setMode] = React.useState<"signin" | "signup">(initialMode);
  const [step, setStep] = React.useState<AuthModalStep>("email");

  // Form states
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [otpCode, setOtpCode] = React.useState("");

  // UI states
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState("");
  const [successMsg, setSuccessMsg] = React.useState("");
  const [timer, setTimer] = React.useState(60);

  // Sync initialMode when modal opens
  const prevOpenRef = React.useRef(open);
  React.useEffect(() => {
    if (open && !prevOpenRef.current) {
      setMode(initialMode);
      setStep("email");
      setErrorMsg("");
      setSuccessMsg("");
      setOtpCode("");
      setPassword("");
      setConfirmPassword("");
    }
    prevOpenRef.current = open;
  }, [open, initialMode]);

  // OTP Countdown timer effect
  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === "verify-otp" && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  const handleContinueEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setErrorMsg("Please enter a valid email address");
      return;
    }
    setErrorMsg("");
    if (mode === "signup") {
      setStep("register-details");
    } else {
      setStep("login-password");
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setErrorMsg("Please enter your password");
      return;
    }
    setLoading(true);
    setErrorMsg("");
    try {
      const response = await login({ email, password });
      setSuccessMsg("Logged in successfully!");

      const loggedInRole = response.data?.user?.role;
      setTimeout(() => {
        onOpenChange(false);
        // Role-Based Navigation: ADMIN to /admin, USER to /explore
        if (loggedInRole === UserRole.ADMIN) {
          router.push("/admin");
        } else {
          router.push("/explore");
        }
      }, 800);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Invalid credentials. Please try again.";
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password || !confirmPassword) {
      setErrorMsg("Please fill in all fields");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match. Please re-enter.");
      return;
    }
    setLoading(true);
    setErrorMsg("");
    try {
      await register({ email, password });
      setStep("verify-otp");
      setTimer(60);
      setSuccessMsg("Verification code sent to your email!");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Registration failed. Email may already be in use.";
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length < 6) {
      setErrorMsg("Please enter the complete 6-digit verification code");
      return;
    }
    setLoading(true);
    setErrorMsg("");
    try {
      await verifyEmail({ email, code: otpCode });
      setSuccessMsg("Email verified successfully! Please sign in to continue.");
      setTimeout(() => {
        setMode("signin");
        setStep("login-password");
      }, 1200);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Invalid or expired verification code.";
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (timer > 0) return;
    setLoading(true);
    setErrorMsg("");
    try {
      await resendCode({ email });
      setTimer(60);
      setSuccessMsg("A new verification code has been sent!");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to resend code.";
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] p-6 sm:p-8 rounded-3xl border border-border bg-card shadow-2xl text-card-foreground">
        <DialogHeader className="sr-only">
          <DialogTitle>Authentication</DialogTitle>
        </DialogHeader>

        {/* Back Button if in sub-step */}
        {step !== "email" && (
          <button
            type="button"
            onClick={() => {
              setErrorMsg("");
              setStep("email");
            }}
            className="absolute left-6 top-6 rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </button>
        )}

        {/* Step 1: Initial Email & Social Screen */}
        {step === "email" && (
          <div className="flex flex-col items-center text-center space-y-6 pt-2">
            <div className="text-4xl animate-bounce-subtle">👋</div>

            <div className="space-y-1">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                {mode === "signin" ? `Welcome to ${siteConfig.name}` : `Join ${siteConfig.name}`}
              </h2>
              <p className="text-xs text-muted-foreground">
                {mode === "signin"
                  ? "Sign in to access your saved trips and personalized itineraries"
                  : "Create an account to start planning AI-powered travel"}
              </p>
            </div>

            {errorMsg && (
              <div className="w-full text-xs font-medium text-destructive bg-destructive/10 border border-destructive/20 p-2.5 rounded-xl">
                {errorMsg}
              </div>
            )}

            {/* Email Form */}
            <form onSubmit={handleContinueEmail} className="w-full space-y-3">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="h-12 rounded-full px-5 text-sm border-input bg-card shadow-2xs focus-visible:ring-2 focus-visible:ring-primary"
              />
              <Button
                type="submit"
                className="w-full h-12 rounded-full bg-black text-white hover:bg-black/90 font-semibold text-sm shadow-md transition-all border border-white/10"
              >
                Continue
              </Button>
            </form>

            {/* Mode Switch Toggle */}
            <div className="text-xs text-muted-foreground">
              {mode === "signin" ? (
                <span>
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signup");
                      setErrorMsg("");
                    }}
                    className="font-bold text-foreground underline hover:text-primary transition-colors"
                  >
                    Sign up
                  </button>
                </span>
              ) : (
                <span>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signin");
                      setErrorMsg("");
                    }}
                    className="font-bold text-foreground underline hover:text-primary transition-colors"
                  >
                    Sign in
                  </button>
                </span>
              )}
            </div>

            {/* Or Separator */}
            <div className="relative w-full flex items-center justify-center my-2">
              <div className="w-full border-t border-border" />
              <span className="absolute bg-card px-3 text-xs text-muted-foreground font-medium">
                or
              </span>
            </div>

            {/* Social Login Buttons */}
            <div className="w-full space-y-3">
              <div className="relative w-full">
                <Badge
                  variant="secondary"
                  className="absolute -top-2.5 right-6 z-10 text-[10px] font-semibold bg-amber-100 text-amber-800 border-amber-200 shadow-2xs px-2 py-0"
                >
                  Last used 👉
                </Badge>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 rounded-full border-border bg-card hover:bg-accent text-foreground text-xs font-semibold gap-3 justify-center shadow-2xs"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </Button>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full h-12 rounded-full border-border bg-card hover:bg-accent text-foreground text-xs font-semibold gap-3 justify-center shadow-2xs"
              >
                <svg className="h-4 w-4 fill-current text-foreground" viewBox="0 0 24 24">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.09c.68-.82 1.14-1.97.98-3.09-.98.04-2.17.65-2.87 1.47-.63.73-1.18 1.9-1.03 3.02 1.1.09 2.23-.58 2.92-1.4" />
                </svg>
                <span>Continue with Apple</span>
              </Button>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed pt-2">
              By continuing, you agree to {siteConfig.name}&apos;s{" "}
              <Link href="#" className="underline hover:text-foreground">
                Terms of Service
              </Link>{" "}
              and acknowledge you&apos;ve read our{" "}
              <Link href="#" className="underline hover:text-foreground">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        )}

        {/* Step 2: Login Password */}
        {step === "login-password" && (
          <div className="flex flex-col items-center text-center space-y-6 pt-4">
            <h3 className="text-xl font-extrabold text-foreground">Welcome back</h3>
            <p className="text-xs text-muted-foreground">
              Enter your password for <span className="font-semibold text-foreground">{email}</span>
            </p>

            {errorMsg && (
              <div className="w-full text-xs font-medium text-destructive bg-destructive/10 border border-destructive/20 p-2.5 rounded-xl">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="w-full space-y-4">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="h-12 rounded-2xl px-4 text-sm"
                autoFocus
              />
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-full bg-black text-white hover:bg-black/90 font-semibold text-sm shadow-md"
              >
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </div>
        )}

        {/* Step 2: Register Details (with Password Confirmation) */}
        {step === "register-details" && (
          <div className="flex flex-col items-center text-center space-y-6 pt-4">
            <h3 className="text-xl font-extrabold text-foreground">Create your account</h3>
            <p className="text-xs text-muted-foreground">
              Registering with <span className="font-semibold text-foreground">{email}</span>
            </p>

            {errorMsg && (
              <div className="w-full text-xs font-medium text-destructive bg-destructive/10 border border-destructive/20 p-2.5 rounded-xl">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} className="w-full space-y-3">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create Password"
                className="h-12 rounded-2xl px-4 text-sm"
                autoFocus
              />
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm Password"
                className="h-12 rounded-2xl px-4 text-sm"
              />
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-full bg-black text-white hover:bg-black/90 font-semibold text-sm shadow-md gap-2"
              >
                <span>{loading ? "Registering..." : "Continue to Verification"}</span>
                <Sparkles className="h-4 w-4 text-amber-200" />
              </Button>
            </form>
          </div>
        )}

        {/* Step 3: Verify Gmail OTP */}
        {step === "verify-otp" && (
          <div className="flex flex-col items-center text-center space-y-6 pt-4">
            <div className="p-3 rounded-full bg-primary/10 text-primary">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-extrabold text-foreground">Check your email</h3>
              <p className="text-xs text-muted-foreground max-w-xs">
                We sent a 6-digit verification code to{" "}
                <span className="font-semibold text-foreground">{email}</span>
              </p>
            </div>

            {errorMsg && (
              <div className="w-full text-xs font-medium text-destructive bg-destructive/10 border border-destructive/20 p-2.5 rounded-xl">
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="w-full text-xs font-medium text-green-600 bg-green-500/10 border border-green-500/20 p-2.5 rounded-xl">
                {successMsg}
              </div>
            )}

            <form onSubmit={handleVerifyOtpSubmit} className="w-full space-y-6">
              <OtpInput value={otpCode} onChange={setOtpCode} disabled={loading} />

              <Button
                type="submit"
                disabled={loading || otpCode.length < 6}
                className="w-full h-12 rounded-full bg-black text-white hover:bg-black/90 font-semibold text-sm shadow-md"
              >
                {loading ? "Verifying..." : "Verify Code"}
              </Button>
            </form>

            <div className="text-xs text-muted-foreground pt-2">
              Didn&apos;t receive code?{" "}
              <button
                type="button"
                onClick={handleResendCode}
                disabled={timer > 0 || loading}
                className={cn(
                  "font-bold text-foreground underline hover:text-primary transition-colors",
                  timer > 0 && "opacity-50 cursor-not-allowed"
                )}
              >
                {timer > 0 ? `Resend in ${timer}s` : "Resend Code"}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
