import React from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../utils/cn";

const glassCardVariants = cva(
  "relative overflow-hidden rounded-[var(--bento-radius,24px)] border border-border/50 bg-surface/80 backdrop-blur-xl shadow-[var(--shadow-bento)] transition-all duration-300",
  {
    variants: {
      variant: {
        default: "hover:border-border/70",
        interactive: "cursor-pointer hover:bg-surface/90 hover:shadow-[var(--shadow-strong)] hover:-translate-y-1 active:scale-[0.98]",
        featured: "bg-gradient-to-br from-surface/90 to-surface-2/90 border-accent/30 shadow-[var(--shadow-glow)]",
        ghost: "bg-transparent border-transparent shadow-none hover:bg-surface/50",
        // Bento Gradient Variants
        "bento-purple": "bg-gradient-to-br from-[#8b5cf6]/90 to-[#6366f1]/90 border-purple-500/30 text-white",
        "bento-teal": "bg-gradient-to-br from-[#14b8a6]/90 to-[#06b6d4]/90 border-teal-500/30 text-white",
        "bento-orange": "bg-gradient-to-br from-[#f97316]/90 to-[#fb923c]/90 border-orange-500/30 text-white",
        "bento-green": "bg-gradient-to-br from-[#10b981]/90 to-[#059669]/90 border-green-500/30 text-white",
        "bento-red": "bg-gradient-to-br from-[#ef4444]/90 to-[#dc2626]/90 border-red-500/30 text-white",
        "bento-blue": "bg-gradient-to-br from-[#3b82f6]/90 to-[#2563eb]/90 border-blue-500/30 text-white",
      },
      padding: {
        none: "p-0",
        sm: "p-4",
        md: "p-6",
        lg: "p-8",
        bento: "p-[var(--bento-padding,24px)]",
      },
    },
    defaultVariants: {
      variant: "default",
      padding: "md",
    },
  }
);

interface GlassCardProps extends Omit<HTMLMotionProps<"div">, "ref"> {
  children: React.ReactNode;
  glow?: boolean;
  variant?: "default" | "interactive" | "featured" | "ghost" | null;
  padding?: "none" | "sm" | "md" | "lg" | null;
  className?: string;
  onClick?: () => void;
}

const MotionDiv = motion.div as any;

export const GlassCard: React.FC<GlassCardProps> = ({
  className,
  variant,
  padding,
  children,
  glow,
  ...props
}) => {
  return (
    <MotionDiv
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className={cn(glassCardVariants({ variant, padding, className }))}
      {...props}
    >
      {glow && (
        <div className="absolute inset-0 bg-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      )}
      <div className="relative z-10 h-full">{children}</div>
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay pointer-events-none" />
    </MotionDiv>
  );
};