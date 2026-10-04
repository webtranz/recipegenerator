import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Recipe Studio | Food Pro",
  description: "Create inventory-linked recipes, plan menus, and export Food Pro CSV files.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/tamimi-favicon.svg",
    shortcut: "/tamimi-favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
