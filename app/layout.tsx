import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "@fancyapps/ui/dist/fancybox/fancybox.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SumTrack",
  description: "SumTrack starter app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script id="sumtrack-theme-init" strategy="beforeInteractive">
          {`
            try {
              const storedTheme = localStorage.getItem("sumtrack-theme");
              const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
              const resolvedTheme = storedTheme === "dark" || storedTheme === "light"
                ? storedTheme
                : (prefersDark ? "dark" : "light");
              const isDark = resolvedTheme === "dark";
              document.documentElement.classList.toggle("dark", isDark);
              document.documentElement.style.colorScheme = isDark ? "dark" : "light";
            } catch (error) {
              document.documentElement.classList.remove("dark");
              document.documentElement.style.colorScheme = "light";
            }
          `}
        </Script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <TooltipProvider delayDuration={0}>
          {children}
          <Toaster />
          <SpeedInsights />
        </TooltipProvider>
      </body>
    </html>
  );
}
