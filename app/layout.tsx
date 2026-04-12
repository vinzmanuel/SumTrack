import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "@fancyapps/ui/dist/fancybox/fancybox.css";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://sumtrack.org"),
  title: {
    default: "SumTrack",
    template: "%s | SumTrack",
  },
  description:
    "SumTrack is a secure microfinance operations platform for Sum Finance Services Corp., covering loans, collections, expenses, reporting, and branch-wide analytics.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "SumTrack",
    description:
      "SumTrack is a secure microfinance operations platform for Sum Finance Services Corp., covering loans, collections, expenses, reporting, and branch-wide analytics.",
    siteName: "SumTrack",
    type: "website",
    url: "https://sumtrack.org",
    images: [
      {
        url: "/icon.png",
        width: 512,
        height: 512,
        alt: "SumTrack",
      },
    ],
  },
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/apple-icon.png",
  },
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
        className={`${inter.variable} ${jetBrainsMono.variable} font-sans antialiased`}
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
