import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/src/components/providers/AuthProvider";
import { DataProvider } from "@/src/components/providers/DataProvider";
import EnvironmentBadge from "@/components/EnvironmentBadge";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Visão Clara",
    template: "%s | Visão Clara",
  },
  description:
    "Gestão de obras e remodelações: checklist por fase, despesas, documentos e responsáveis de obra num só lugar.",
  // Private beta: keep the app out of search engines until launch is opened up
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-PT">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <DataProvider>
            {children}
          </DataProvider>
        </AuthProvider>
        <EnvironmentBadge />
      </body>
    </html>
  );
}
