import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Frentia",
  description: "Gestão de frentes, turnos e campo em tempo real",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
