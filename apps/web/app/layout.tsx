import type { Metadata, Viewport } from "next";
import { EB_Garamond, Inter, Noto_Sans_Mono, Caveat } from "next/font/google";
import "./globals.css";

const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const notoSansMono = Noto_Sans_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-chalk",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F3E7D3" },
    { media: "(prefers-color-scheme: dark)", color: "#151110" },
  ],
};

export const metadata: Metadata = {
  title: "smol café",
  description: "A warm, literary neighbourhood café with a day-to-night personality in Rishikesh.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "smol café",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
  },
};

import { LayoutShell } from "@/components/navigation/LayoutShell";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${ebGaramond.variable} ${inter.variable} ${notoSansMono.variable} ${caveat.variable}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('smol_theme');
                  var isDark;
                  if (saved === 'night' || saved === 'dark') {
                    isDark = true;
                  } else if (saved === 'day' || saved === 'light') {
                    isDark = false;
                  } else {
                    // Default Auto: 6:00 PM (18:00) to 4:00 AM (04:00) Indian Standard Time (IST)
                    try {
                      var istHour = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false }).format(new Date()), 10);
                      isDark = (istHour >= 18 || istHour < 4);
                    } catch (err) {
                      var utc = Date.now() + (new Date().getTimezoneOffset() * 60000);
                      var istDate = new Date(utc + (3600000 * 5.5));
                      var h = istDate.getHours();
                      isDark = (h >= 18 || h < 4);
                    }
                  }
                  var targetColor = isDark ? '#151110' : '#F3E7D3';
                  if (isDark) {
                    document.documentElement.classList.add('dark');
                    document.documentElement.setAttribute('data-theme', 'night');
                  } else {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.setAttribute('data-theme', 'day');
                  }
                  var meta = document.querySelector('meta[name="theme-color"]');
                  if (meta) {
                    meta.setAttribute('content', targetColor);
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="antialiased min-h-screen bg-[#F3E7D3] dark:bg-[#241F1C] text-[#241F1C] dark:text-[#F3E7D3] font-sans selection:bg-[#B72E35]/20 selection:text-[#B72E35]">
        <LayoutShell>
          {children}
        </LayoutShell>
      </body>
    </html>
  );
}

