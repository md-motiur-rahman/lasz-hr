import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
// @ts-ignore - allow side-effect CSS import without module declarations
import "./globals.css";
import RouteProgress from "@/components/RouteProgress";
import PageTransition from "@/components/PageTransition";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: {
    default: "LASZ HR — Modern HR, Leave, and Rota Management",
    template: "%s | LASZ HR",
  },
  description:
    "LASZ HR simplifies employee management, leave tracking, and rota scheduling for growing teams. Secure, fast, and easy to use.",
  applicationName: "LASZ HR",
  keywords: [
    "HR software",
    "employee management",
    "leave management",
    "rota scheduling",
    "workforce management",
    "time off",
    "Next.js",
    "Supabase",
    "Stripe",
  ],
  authors: [{ name: "LASZ Corp Ltd" }],
  creator: "LASZ Corp Ltd",
  publisher: "LASZ Corp Ltd",
  category: "Business",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "LASZ HR",
    title: "LASZ HR — Modern HR, Leave, and Rota Management",
    description:
      "LASZ HR simplifies employee management, leave tracking, and rota scheduling for growing teams.",
    images: [
      {
        url: "/favicon.ico",
        width: 1200,
        height: 630,
        alt: "LASZ HR",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LASZ HR — Modern HR, Leave, and Rota Management",
    description:
      "LASZ HR simplifies employee management, leave tracking, and rota scheduling for growing teams.",
    images: ["/next.svg"],
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  referrer: "origin-when-cross-origin",
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <RouteProgress />
        <PageTransition>{children}</PageTransition>
      </body>
    </html>
  );
}
