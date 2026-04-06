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
  title: "SumTrack",
  description: "SumTrack starter app",
  icons: {
    icon: "/Logo/SUMTRACK%20LOGO.png",
    shortcut: "/Logo/SUMTRACK%20LOGO.png",
    apple: "/Logo/SUMTRACK%20LOGO.png",
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
        <link href="/Logo/SUMTRACK%20LOGO.png" rel="icon" type="image/png" />
        <link href="/Logo/SUMTRACK%20LOGO.png" rel="shortcut icon" type="image/png" />
        <link href="/Logo/SUMTRACK%20LOGO.png" rel="apple-touch-icon" />
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
