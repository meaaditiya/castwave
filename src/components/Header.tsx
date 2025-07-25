"use client";

import { Mic, LogOut, Loader2, PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from './ui/button';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export function Header() {
  const { currentUser, logout, loading } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/');
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Link href="/" className="flex items-center space-x-2 mr-auto">
          <Mic className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg font-headline">CastWave</span>
        </Link>
        {loading ? (
          <Loader2 className="animate-spin" />
        ) : currentUser ? (
          <div className="flex items-center space-x-2">
            <Button variant="outline" asChild>
                <Link href="/podcast/create">
                    <PlusCircle />
                    Create Podcast
                </Link>
            </Button>
            <Button variant="ghost" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Log Out
            </Button>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <Button variant="ghost" asChild>
              <Link href="/login">Log In</Link>
            </Button>
            <Button className="bg-accent hover:bg-accent/90" asChild>
              <Link href="/signup">Sign Up</Link>
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
