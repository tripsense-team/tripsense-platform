import Link from "next/link";
import { Compass, Globe, Share2, MessageCircle } from "lucide-react";
import { siteConfig } from "@/config/site";

export function LandingFooter() {
  return (
    <footer className="w-full border-t border-border bg-card text-card-foreground transition-colors">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12">
          {/* Brand Column */}
          <div className="space-y-4 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 font-bold text-xl tracking-tight text-foreground">
              <div className="p-1.5 rounded-xl bg-primary text-primary-foreground">
                <Compass className="h-5 w-5" />
              </div>
              <span>{siteConfig.name}</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              AI-powered smart travel planning platform built for modern explorers.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <Link href="#" className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors">
                <Globe className="h-4 w-4" />
              </Link>
              <Link href="#" className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors">
                <Share2 className="h-4 w-4" />
              </Link>
              <Link href="#" className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors">
                <MessageCircle className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Product Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Product</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/explore" className="hover:text-foreground transition-colors">Explore Places</Link></li>
              <li><Link href="/ai-planner" className="hover:text-foreground transition-colors">AI Itinerary Planner</Link></li>
              <li><Link href="/trips" className="hover:text-foreground transition-colors">Trip Manager</Link></li>
              <li><Link href="/collections" className="hover:text-foreground transition-colors">Curated Collections</Link></li>
            </ul>
          </div>

          {/* Company Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Company</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="#about" className="hover:text-foreground transition-colors">About Us</Link></li>
              <li><Link href="#careers" className="hover:text-foreground transition-colors">Careers</Link></li>
              <li><Link href="#blog" className="hover:text-foreground transition-colors">Travel Blog</Link></li>
              <li><Link href="#press" className="hover:text-foreground transition-colors">Press & Media</Link></li>
            </ul>
          </div>

          {/* Legal Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="#privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link></li>
              <li><Link href="#terms" className="hover:text-foreground transition-colors">Terms of Service</Link></li>
              <li><Link href="#security" className="hover:text-foreground transition-colors">Security</Link></li>
              <li><Link href="#cookies" className="hover:text-foreground transition-colors">Cookie Preferences</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} TripSense. All rights reserved.</p>
          <p className="flex items-center gap-1">
            <span>Powered by Microservices Architecture & AI</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
