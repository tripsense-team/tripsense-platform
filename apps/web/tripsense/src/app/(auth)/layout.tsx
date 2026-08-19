import * as React from "react";
import Link from "next/link";
import { Compass } from "lucide-react";
import { siteConfig } from "@/config/site";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="mb-8 flex items-center gap-2 font-bold text-xl">
        <Compass className="h-7 w-7 text-primary" />
        <Link href="/">{siteConfig.name}</Link>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
