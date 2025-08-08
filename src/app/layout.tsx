import type {Metadata} from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'CastWave - Live Audio Chat Rooms',
  description: 'A platform for real-time live audio conversations and podcasting.',
  icons: {
    icon: '/favicon.ico', // Place your favicon.ico in the `public` directory
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans bg-background text-foreground antialiased`}>
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
            themes={['light', 'dark', 'rose', 'green', 'orange']}
        >
            <AuthProvider>
              {children}
            </AuthProvider>
            <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
