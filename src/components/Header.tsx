
"use client";

import { Waves, LogOut, Loader2, PlusCircle, User, CheckCircle, XCircle, Rss } from 'lucide-react';
import Link from 'next/link';
import { Button } from './ui/button';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from './ThemeToggle';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { useState } from 'react';

export function Header() {
  const { currentUser, logout, loading } = useAuth();
  const router = useRouter();
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isNavigatingToFeed, setIsNavigatingToFeed] = useState(false);
  const [isNavigatingToProfile, setIsNavigatingToProfile] = useState(false);


  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

  const handleCreateSessionClick = () => {
    setIsCreatingSession(true);
    router.push('/chatroom/create');
  };

  const handleFeedClick = () => {
    setIsNavigatingToFeed(true);
    router.push('/feed');
  }

  const handleProfileClick = () => {
    setIsNavigatingToProfile(true);
    router.push('/profile');
  }


  const getInitials = (usernameOrEmail: string | undefined | null) => {
    if (!usernameOrEmail) return '..';
    const username = usernameOrEmail.split('@')[0];
    if (username.length > 2) {
        return username.substring(0, 2).toUpperCase();
    }
    return username.toUpperCase();
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 w-full items-center justify-between px-4">
        <Link href="/" className="flex items-center space-x-2">
          <Waves className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg">CastWave</span>
        </Link>
        <div className="flex items-center space-x-1 sm:space-x-2">
            <ThemeToggle />
            {loading ? (
              <Loader2 className="animate-spin" />
            ) : currentUser ? (
              <>
                <Button variant="ghost" onClick={handleFeedClick} disabled={isNavigatingToFeed} className="hidden sm:flex px-2 sm:px-3">
                    {isNavigatingToFeed ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rss className="h-4 w-4" />}
                    <span className="hidden sm:inline ml-2">Feed</span>
                </Button>
                <Button variant="ghost" onClick={handleCreateSessionClick} disabled={isCreatingSession} className="flex px-2 sm:px-3">
                    {isCreatingSession ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <PlusCircle className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline ml-2">Create Session</span>
                </Button>
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={currentUser.profile?.photoURL} alt={currentUser.profile?.username} />
                                <AvatarFallback>{getInitials(currentUser.profile?.username || currentUser.email)}</AvatarFallback>
                            </Avatar>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel className="flex items-center gap-2">
                           {currentUser.profile?.username || 'My Account'}
                           {currentUser.emailVerified ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                                <XCircle className="h-4 w-4 text-red-500" />
                           )}
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleProfileClick} disabled={isNavigatingToProfile}>
                            {isNavigatingToProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <User className="mr-2 h-4 w-4"/>}
                            Profile
                        </DropdownMenuItem>
                         <DropdownMenuItem onClick={handleFeedClick} disabled={isNavigatingToFeed} className="sm:hidden">
                           {isNavigatingToFeed ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rss className="mr-2 h-4 w-4"/>}
                           Feed
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleCreateSessionClick} className="sm:hidden">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Create Session
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleLogout}>
                            <LogOut className="mr-2 h-4 w-4" />
                            Log out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link href="/login">Log In</Link>
                </Button>
                <Button asChild>
                  <Link href="/signup">Sign Up</Link>
                </Button>
              </>
            )}
        </div>
      </div>
    </header>
  );
}
