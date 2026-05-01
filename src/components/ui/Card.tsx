import * as React from "react";
import { cn } from "@/lib/utils";

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-2xl glass-morphism border-white/10 p-6 shadow-2xl overflow-hidden relative",
      className
    )}
    {...props}
  >
    {/* Subtle gradient overlay */}
    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent-purple/40 via-accent-blue/40 to-accent-cyan/40 opacity-50" />
    {props.children}
  </div>
));
Card.displayName = "Card";

export { Card };
