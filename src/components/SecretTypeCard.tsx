import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SecretTypeCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  selected?: boolean;
  onClick?: () => void;
}

export function SecretTypeCard({
  icon: Icon,
  title,
  description,
  selected,
  onClick,
}: SecretTypeCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex flex-col items-center p-6 rounded-xl border transition-all duration-300",
        "hover:scale-[1.02] active:scale-[0.98]",
        selected
          ? "bg-primary/10 border-primary shadow-ember"
          : "bg-card/50 border-border hover:border-primary/50 hover:bg-card"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center w-14 h-14 rounded-xl mb-4 transition-all duration-300",
          selected
            ? "bg-primary text-primary-foreground shadow-ember"
            : "bg-secondary text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary"
        )}
      >
        <Icon className="w-7 h-7" />
      </div>
      <h3
        className={cn(
          "font-semibold mb-1 transition-colors",
          selected ? "text-primary" : "text-foreground"
        )}
      >
        {title}
      </h3>
      <p className="text-sm text-muted-foreground text-center">{description}</p>
      
      {selected && (
        <div className="absolute inset-0 rounded-xl bg-gradient-radial-ember opacity-50 pointer-events-none" />
      )}
    </button>
  );
}
