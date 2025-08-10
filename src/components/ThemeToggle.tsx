
"use client"

import * as React from "react"
import { Monitor, Moon, Palette, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

const themes = [
    { name: 'Light', theme: 'light', icon: Sun },
    { name: 'Dark', theme: 'dark', icon: Moon },
    { name: 'System', theme: 'system', icon: Monitor },
    { name: 'Rose', theme: 'rose', icon: Palette },
    { name: 'Green', theme: 'green', icon: Palette },
    { name: 'Orange', theme: 'orange', icon: Palette },
    { name: 'Blue', theme: 'blue', icon: Palette },
    { name: 'Violet', theme: 'violet', icon: Palette },
    { name: 'Yellow', theme: 'yellow', icon: Palette },
    { name: 'Slate', theme: 'slate', icon: Palette },
    { name: 'Stone', theme: 'stone', icon: Palette },
];

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [previewTheme, setPreviewTheme] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (previewTheme) {
      document.documentElement.classList.remove(...themes.map(t => t.theme));
      document.documentElement.classList.add(previewTheme);
    } else {
      document.documentElement.classList.remove(...themes.map(t => t.theme));
      if (resolvedTheme) {
        document.documentElement.classList.add(resolvedTheme);
      }
    }
  }, [previewTheme, resolvedTheme]);

  const handleMouseLeave = () => {
    setPreviewTheme(null);
  }

  const handleThemeSelect = (selectedTheme: string) => {
    setTheme(selectedTheme);
    setPreviewTheme(null);
  };

  return (
    <DropdownMenu onOpenChange={(open) => !open && handleMouseLeave()}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-w-[320px]" onMouseLeave={handleMouseLeave}>
        <DropdownMenuLabel>Select a Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="grid grid-cols-2 gap-2 p-2">
            {themes.map(({ name, theme: themeValue, icon: Icon }) => (
                <div key={themeValue}
                    onMouseEnter={() => setPreviewTheme(themeValue)}
                    onClick={() => handleThemeSelect(themeValue)}
                >
                    <div
                        className={cn(
                        "flex flex-col items-center justify-center p-2 rounded-md cursor-pointer border-2",
                        theme === themeValue ? "border-primary" : "border-transparent",
                        "hover:border-primary/50"
                        )}
                    >
                         <div
                            className={cn(
                                "w-full h-16 rounded-md mb-2 flex items-center justify-center border",
                                themeValue === 'light' ? 'bg-white' :
                                themeValue === 'dark' ? 'bg-[#09090b]' :
                                themeValue === 'rose' ? 'bg-rose-50' :
                                themeValue === 'green' ? 'bg-green-50' :
                                themeValue === 'orange' ? 'bg-orange-50' :
                                themeValue === 'blue' ? 'bg-blue-50' :
                                themeValue === 'violet' ? 'bg-violet-50' :
                                themeValue === 'yellow' ? 'bg-yellow-50' :
                                themeValue === 'slate' ? 'bg-[#0f172a]' :
                                themeValue === 'stone' ? 'bg-stone-100' :
                                'bg-background'
                            )}
                        >
                             <div className={cn(
                                "p-2 rounded-full",
                                themeValue === 'light' ? 'bg-zinc-200' :
                                themeValue === 'dark' ? 'bg-[#1f2937]' :
                                themeValue === 'rose' ? 'bg-rose-200' :
                                themeValue === 'green' ? 'bg-green-200' :
                                themeValue === 'orange' ? 'bg-orange-200' :
                                themeValue === 'blue' ? 'bg-blue-200' :
                                themeValue === 'violet' ? 'bg-violet-200' :
                                themeValue === 'yellow' ? 'bg-yellow-200' :
                                themeValue === 'slate' ? 'bg-slate-500' :
                                themeValue === 'stone' ? 'bg-stone-300' :
                                 'bg-muted'
                             )}>
                                <Icon className={cn(
                                     "h-5 w-5",
                                     themeValue === 'light' ? 'text-zinc-600' :
                                     themeValue === 'dark' ? 'text-white' :
                                     themeValue === 'rose' ? 'text-rose-500' :
                                     themeValue === 'green' ? 'text-green-500' :
                                     themeValue === 'orange' ? 'text-orange-500' :
                                     themeValue === 'blue' ? 'text-blue-500' :
                                     themeValue === 'violet' ? 'text-violet-500' :
                                     themeValue === 'yellow' ? 'text-yellow-500' :
                                     themeValue === 'slate' ? 'text-slate-100' :
                                     themeValue === 'stone' ? 'text-stone-600' :
                                     'text-foreground'
                                )} />
                             </div>
                         </div>
                        <span className="text-xs font-medium">{name}</span>
                    </div>
                </div>
            ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
