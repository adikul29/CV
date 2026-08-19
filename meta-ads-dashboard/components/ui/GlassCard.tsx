import { HTMLAttributes, ReactNode } from "react";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  accent?: "rose" | "cyan" | "emerald" | "none";
}

const accentGlow: Record<string, string> = {
  rose: "hover:shadow-glow",
  cyan: "hover:shadow-glowCyan",
  emerald: "hover:shadow-glowCyan",
  none: "",
};

export default function GlassCard({ children, accent = "none", className = "", ...rest }: GlassCardProps) {
  return (
    <div
      className={`glass-card print-break transition-shadow duration-300 ${accentGlow[accent]} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
