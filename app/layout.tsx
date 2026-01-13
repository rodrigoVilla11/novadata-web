import "./globals.css";
import type { Metadata, Viewport } from "next";
import { AuthProvider } from "./providers/AuthProvider";
import { ReduxProvider } from "./providers/ReduxProvider";

export const metadata: Metadata = {
  title: {
    default: "Gourmetify",
    template: "%s | Gourmetify",
  },
  description:
    "Gourmetify es una plataforma de gestión gastronómica para controlar ventas, stock y caja en tiempo real.",
  applicationName: "Gourmetify",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#144336",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <ReduxProvider>
          <AuthProvider>{children}</AuthProvider>
        </ReduxProvider>
      </body>
    </html>
  );
}
