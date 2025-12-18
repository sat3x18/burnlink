import { Flame } from "lucide-react";

interface BurnLinkLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

export function BurnLinkLogo({ className, size = "md", showText = true }: BurnLinkLogoProps) {
  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  const textSizeClasses = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-3xl",
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative">
        <Flame 
          className={`${sizeClasses[size]} text-primary animate-flame-flicker`}
          strokeWidth={2.5}
        />
        <div className="absolute inset-0 blur-md bg-primary/40 rounded-full" />
      </div>
      {showText && (
        <span className={`font-bold ${textSizeClasses[size]} tracking-tight`}>
          <span className="text-foreground">Burn</span>
          <span className="ember-text">Link</span>
        </span>
      )}
    </div>
  );
}
