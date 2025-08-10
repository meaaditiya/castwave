
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
    // When previewTheme is active, apply it to the document
    if (previewTheme) {
        document.documentElement.className = previewTheme;
    } else {
        // When not previewing, revert to the actual resolved theme
        if(resolvedTheme) document.documentElement.className = resolvedTheme;
    }
  }, [previewTheme, resolvedTheme]);


  const handleMouseLeave = () => {
    setPreviewTheme(null);
  }

  const handleThemeSelect = (selectedTheme: string) => {
    setTheme(selectedTheme);
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
      <DropdownMenuContent 
        align="end" 
        className="w-[300px] max-h-[80vh] overflow-y-auto theme-grid-dropdown" 
        onMouseLeave={handleMouseLeave}
      >
        <DropdownMenuLabel>Select a Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="grid grid-cols-2 gap-2 p-2">
            {themes.map(({ name, theme: themeValue, icon: Icon }) => (
                <DropdownMenuItem
                    key={themeValue}
                    onClick={() => handleThemeSelect(themeValue)}
                    onMouseEnter={() => setPreviewTheme(themeValue)}
                    className="p-0"
                >
                    <div
                        className={cn(
                        "w-full flex flex-col items-center justify-center p-2 rounded-md cursor-pointer border-2",
                        theme === themeValue ? "border-primary" : "border-transparent",
                        "hover:border-primary/50"
                        )}
                    >
                         <div
                            className={cn(
                                "w-full h-16 rounded-md mb-2 flex items-center justify-center border",
                                `theme-preview-${themeValue}`
                            )}
                        >
                             <div className={cn("p-2 rounded-full", "theme-icon")}>
                                <Icon className="h-5 w-5" />
                             </div>
                         </div>
                        <span className="text-xs font-medium">{name}</span>
                    </div>
                </DropdownMenuItem>
            ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
