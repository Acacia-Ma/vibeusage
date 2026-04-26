import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
} from "react";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";

import { cn } from "../../lib/utils";

// shadcn-style ergonomic wrapper over base-ui Tooltip primitives.
// Source pattern adapted from shadcn/ui base-ui registry. The raw upstream
// classNames are immediately rewritten to v3 SSOT tokens by
// `node scripts/shadcn-retro-fit.mjs` against scripts/shadcn-mapping.json.
// Do not author tokens here by hand — let the retro-fitter own the mapping.
// SSOT: dashboard/DESIGN.md §12.

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

interface TooltipContentProps
  extends ComponentPropsWithoutRef<typeof TooltipPrimitive.Popup> {
  sideOffset?: number;
}

const TooltipContent = forwardRef<
  ElementRef<typeof TooltipPrimitive.Popup>,
  TooltipContentProps
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Positioner sideOffset={sideOffset}>
      <TooltipPrimitive.Popup
        ref={ref}
        className={cn(
          "z-50 overflow-hidden bg-ink px-3 py-1.5 text-micro text-surface border border-ink-line shadow-glow-sm",
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Positioner>
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = "TooltipContent";

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
