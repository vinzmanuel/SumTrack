"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Lock, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import styles from "@/components/marketing/marketing-page.module.css";
import { SumtrackBrand } from "@/components/marketing/sumtrack-brand";

const navItems = [
  { href: "#gap", label: "Bridging the Gap" },
  { href: "#features", label: "Features" },
  { href: "#partner", label: "Partner" },
  { href: "#contact", label: "Contact Us" },
];

export function MarketingNav() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <nav
      className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] transition-colors duration-200"
      style={{
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        background: isScrolled
          ? "rgba(10, 14, 23, 0.95)"
          : "rgba(10, 14, 23, 0.75)",
      }}
    >
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-4 sm:h-16 sm:px-6 lg:px-10">
        <a
          aria-label="SumTrack Home"
          className={styles.navLink}
          href="#hero"
          onClick={() => setMobileMenuOpen(false)}
        >
          <SumtrackBrand className="h-7 w-auto sm:h-9" priority />
        </a>
        <div className="hidden items-center gap-8 md:flex">
          {navItems.map((item) => (
            <a
              className={cn(
                styles.navLink,
                "text-sm font-medium text-white/60 hover:text-white"
              )}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </a>
          ))}
          <Link
            className={cn(
              styles.baseButton,
              "inline-flex items-center gap-2 rounded-lg bg-[#e53935] px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-600"
            )}
            href="/login"
            style={{
              boxShadow:
                "0 2px 12px rgba(229,57,53,0.3), 0 1px 3px rgba(0,0,0,0.2)",
            }}
          >
            Log In
          </Link>
        </div>
        <button
          aria-label="Toggle Menu"
          className={cn(styles.navLink, "p-2 text-white/60 md:hidden")}
          type="button"
          onClick={() => setMobileMenuOpen((current) => !current)}
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      {mobileMenuOpen ? (
        <div
          className="space-y-3 border-t border-white/[0.06] px-4 py-4 sm:px-6 md:hidden"
          style={{ background: "rgba(10, 14, 23, 0.95)" }}
        >
          {navItems.map((item) => (
            <a
              className={cn(
                styles.navLink,
                "block py-1 text-sm font-medium text-white/60 hover:text-white"
              )}
              href={item.href}
              key={item.href}
              onClick={() => setMobileMenuOpen(false)}
            >
              {item.label}
            </a>
          ))}
          <Link
            className={cn(
              styles.baseButton,
              "mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#e53935] px-5 py-2.5 text-sm font-semibold text-white"
            )}
            href="/login"
            onClick={() => setMobileMenuOpen(false)}
          >
            <Lock className="h-4 w-4" />
            Log In
          </Link>
        </div>
      ) : null}
    </nav>
  );
}
