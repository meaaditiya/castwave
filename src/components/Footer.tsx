
"use client";

import Link from 'next/link';
import { Phone } from 'lucide-react';

export function Footer() {
  return (
    <footer className="w-full border-t border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between py-4 px-4 text-xs text-muted-foreground gap-4">
        <p className="text-center sm:text-left">
          &copy; {new Date().getFullYear()} CastWave. All Rights Reserved.
        </p>
        <Link href="https://connectwithaaditiya.onrender.com/contact" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:text-primary transition-colors">
            <Phone className="h-3 w-3 text-black dark:text-white" />
            Contact for help
        </Link>
      </div>
    </footer>
  );
}
