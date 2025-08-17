// src/app/layout.tsx
import "./globals.css";
import { Providers } from "./providers";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Dark-only: set class on HTML to avoid hydration issues
    <html lang="en" className="dark">
      <body className="bg-zinc-950 text-zinc-100">
        <Providers>
          <div className="p-4">
            <div className="mb-4 flex items-center justify-between">
              <h1 className="text-xl font-semibold">Setd</h1>
            </div>
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}