
"use client";

import { Waves } from 'lucide-react';

export function LoadingScreen() {
    return (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background">
            <div className="relative flex items-center justify-center">
                <div className="absolute h-24 w-24 bg-primary/20 rounded-full animate-pulse blur-2xl"></div>
                <Waves className="h-16 w-16 text-primary z-10" />
            </div>
            <p className="text-lg font-medium text-muted-foreground mt-4 animate-pulse">
                Welcome to CastWave
            </p>
        </div>
    )
}
