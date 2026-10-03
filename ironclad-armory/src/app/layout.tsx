import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/components/CartProvider";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SWRegister from "@/components/SWRegister";
import InstallPrompt from "@/components/InstallPrompt";
import MobileTabBar from "@/components/MobileTabBar";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "600", "700"],
});

const body = Inter({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: {
    default: "mark-armour — Firearms, Optics & Tactical Gear",
    template: "%s · mark-armour",
  },
  description:
    "Premium rifles, pistols, shotguns, optics, ammunition and tactical gear. Real product photography, 18+ ID verification, database-backed checkout and instant order confirmations.",
  applicationName: "mark-armour",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "mark-armour",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#070908" },
    { media: "(prefers-color-scheme: light)", color: "#f7f4ee" },
  ],
};

// Data lives in Postgres — render fresh on every request.
export const dynamic = "force-dynamic";

// Apply the saved/system theme before first paint (no flash).
const themeScript = `(function(){try{var t=localStorage.getItem("mark-armour-theme");if(t!=="dark"&&t!=="light"){t=window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="dark"}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png" sizes="180x180" />
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-32.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="flex min-h-screen flex-col pb-[calc(4.75rem_+_env(safe-area-inset-bottom))] md:pb-0">
        <CartProvider>
          <Navbar />
          {/* Bottom tab bar clearance: fixed bar (~4.5rem) + device safe area. */}
          <main className="flex-1 pb-[calc(4.75rem_+_env(safe-area-inset-bottom))] md:pb-0">{children}</main>
          <Footer />
          <MobileTabBar />
          <InstallPrompt />
          <SWRegister />
        </CartProvider>
      </body>
    </html>
  );
}
