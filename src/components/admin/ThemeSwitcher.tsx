import { Check, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

export function ThemeSwitcher() {
  const { theme, setTheme, themes, meta } = useTheme();

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 rounded-xl border-white/12 bg-white/5 px-2.5 sm:px-3"
              aria-label={`Theme: ${meta[theme].label}. Choose a colour variation.`}
            >
              <span
                aria-hidden
                className="size-3.5 shrink-0 rounded-full ring-1 ring-white/25"
                style={{ background: meta[theme].swatch }}
              />
              <Palette className="size-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">{meta[theme].label}</span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Colour theme</TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-sm font-medium text-foreground">
            Colour themes
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Mews One = exact app colours
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {themes.map((id) => {
          const active = theme === id;
          return (
            <DropdownMenuItem
              key={id}
              onClick={() => setTheme(id)}
              className={cn(
                "cursor-pointer gap-3 rounded-lg py-2.5",
                active && "bg-primary/10",
              )}
            >
              <span
                aria-hidden
                className="size-5 shrink-0 rounded-full shadow-inner ring-1 ring-white/20"
                style={{ background: meta[id].swatch }}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{meta[id].label}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {meta[id].description}
                </span>
              </span>
              {active ? (
                <Check className="size-4 shrink-0 text-primary" aria-hidden />
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
