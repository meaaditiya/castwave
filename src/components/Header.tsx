import { Mic } from 'lucide-react';
import Link from 'next/link';
import { Button } from './ui/button';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Link href="/" className="flex items-center space-x-2 mr-auto">
          <Mic className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg font-headline">CastWave</span>
        </Link>
        <Button variant="ghost">Log In</Button>
        <Button className="bg-accent hover:bg-accent/90">Sign Up</Button>
      </div>
    </header>
  );
}
