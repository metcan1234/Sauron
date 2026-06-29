import type { Metadata } from "next";
import {
  Inter,
  Source_Serif_4,
  DM_Sans,
  Space_Grotesk,
  Playfair_Display,
} from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const sourceSerif = Source_Serif_4({ subsets: ["latin"], variable: "--font-display-kurumsal" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-display-modern" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-display-modern-alt" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-display-luks" });

export const metadata: Metadata = {
  title: {
    default: "{{PAGE_HOME_SEO_TITLE}}",
    template: "%s | {{COMPANY_NAME}}",
  },
  description: "{{PAGE_HOME_SEO_DESCRIPTION}}",
  metadataBase: new URL("https://example.com"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="{{LOCALE}}"
      data-theme="{{THEME_ID}}"
      className={`${inter.variable} ${sourceSerif.variable} ${dmSans.variable} ${spaceGrotesk.variable} ${playfair.variable}`}
    >
      <body className="min-h-screen flex flex-col">
        <a href="#main-content" className="skip-link">
          {{SKIP_LINK_TEXT}}
        </a>
        <Navbar />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
