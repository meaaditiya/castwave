
import type {Metadata, Viewport} from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { Footer } from '@/components/Footer';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'CastWave - Live Chat Rooms',
  description: 'A platform for real-time live conversations and community engagement.',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico', 
    apple: "/icons/icon-192x192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#222222",
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans bg-background text-foreground antialiased flex flex-col min-h-screen`}>
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
            themes={['light', 'dark', 'rose', 'green', 'orange', 'blue', 'violet', 'yellow', 'slate', 'stone', 'zinc', 'lime', 'sky', 'amber', 'teal']}
        >
            <AuthProvider>
              <div className="flex-1">
                {children}
              </div>
              <Footer />
            </AuthProvider>
            <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
