import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { label: string; value: string }[];
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, options, ...props }, ref) => {
    return (
      <div className="space-y-2 w-full group">
        {label && (
          <label className="text-xs font-semibold text-white/40 ml-1 uppercase tracking-wider group-focus-within:text-accent-purple transition-colors">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            className={cn(
              "flex h-12 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition-all duration-300",
              "focus:outline-none focus:ring-2 focus:ring-accent-purple/20 focus:border-accent-purple/40",
              "disabled:cursor-not-allowed disabled:opacity-50 appearance-none cursor-pointer",
              className
            )}
            ref={ref}
            {...props}
          >
            <option value="" disabled className="bg-[#131314] text-white/40">Select an option</option>
            {options.map((option) => (
              <option key={option.value} value={option.value} className="bg-[#131314] text-white">
                {option.label}
              </option>
            ))}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/20 group-hover:text-white/40 transition-colors">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
      </div>
    );
  }
);
Select.displayName = "Select";

export { Select };
