import "./globals.css";
import type { Metadata } from "next";
import { Roboto, Inter } from "next/font/google";
import { UIStateProvider } from "@/components/ui-state";
import { Shell } from "@/components/shell";
import { GROUP_NAME } from "@/lib/config";

// PlayStation SST is proprietary; per the design system's substitute guidance:
// Roboto Light (300) for the display tier, Inter for body + chrome.
const display = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-display",
  display: "swap",
});
const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Group MIS Console",
  description:
    "Consolidation MIS for a business group — Tally-export ingestion and inter-company elimination.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable}`}
    >
      <head>
        {/* Set the theme before first paint to avoid a light→dark flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('gmis.theme');document.documentElement.setAttribute('data-theme',t==='dark'?'dark':'light');}catch(e){}`,
          }}
        />
      </head>
      <body>
        <UIStateProvider>
          <Shell groupName={GROUP_NAME}>{children}</Shell>
        </UIStateProvider>
      </body>
    </html>
  );
}
