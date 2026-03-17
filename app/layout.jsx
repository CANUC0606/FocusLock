import "./globals.css";

export const metadata = {
  title: "FocusLock MVP",
  description: "Bloqueio com verificacao por IA e fluxo mobile-first",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
