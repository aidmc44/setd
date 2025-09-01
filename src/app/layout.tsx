// src/app/layout.tsx
import "./globals.css";
import { Providers } from "./providers";


export const metadata = {
	  // dark-only site
	  themeColor: "#0b0b0d",
	  colorScheme: "dark",
	  icons: {
	    icon: [{ url: "/favicon.ico" }], // or "/your-icon.png"
	  },
	};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Dark-only: set class on HTML to avoid hydration issues
    <html lang="en" className="dark">
      <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png"></link>
      <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png"></link>
      <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png"></link>
      <link rel="manifest" href="/site.webmanifest"></link>
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