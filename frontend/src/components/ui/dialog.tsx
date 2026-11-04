import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
export function Dialog({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dialog-overlay" />
        <DialogPrimitive.Content className="dialog-content" aria-describedby={undefined}>
          <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
          {children}
          <DialogPrimitive.Close className="dialog-close" aria-label="Close dialog">
            ×
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
