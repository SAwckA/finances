import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/app/providers";

export const metadata: Metadata = {
  title: "Finances Frontend",
  description: "Next.js + HeroUI frontend for the finances project.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k="finances.theme.preference";var v=localStorage.getItem(k);var p=v==="light"||v==="dark"||v==="system"?v:"system";var s=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";var t=p==="system"?s:p;document.documentElement.dataset.theme=t;document.documentElement.classList.toggle("dark",t==="dark");}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
