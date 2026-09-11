import type { Metadata } from "next";
import { Fragment_Mono, Source_Serif_4, Work_Sans } from "next/font/google";
import { SmoothScroll } from "@/components/smooth-scroll";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { AppToaster } from "@/components/ui/app-toaster";
import "./globals.css";

const sourceSerif = Source_Serif_4({
  subsets: [
    "latin",
  ],
  variable: "--font-source-serif",
});

const workSans = Work_Sans({
  subsets: [
    "latin",
  ],
  variable: "--font-work-sans",
});

const fragmentMono = Fragment_Mono({
  subsets: [
    "latin",
  ],
  variable: "--font-fragment-mono",
  weight: "400",
});

export const metadata: Metadata = {
  description:
    "A headless, provider-agnostic file transfer engine for TypeScript and JavaScript. Concurrency, chunking, multipart, retries, and resumable persistence — no UI, no lock-in.",
  title: "Upflowi — A headless file transfer engine",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      className={`${sourceSerif.variable} ${workSans.variable} ${fragmentMono.variable}`}
      lang="en"
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-bg font-body text-ink antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
        >
          <SmoothScroll>{children}</SmoothScroll>
          <AppToaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
