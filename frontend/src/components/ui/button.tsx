import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

const buttonVariants = cva("pms-button", {
  variants: { variant: { default: "pms-button-primary", outline: "pms-button-outline" } },
  defaultVariants: { variant: "default" },
});

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type ButtonProps = React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean };
function Button({ className, variant, asChild = false, type = "button", ...props }: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return (
    <Component className={cn(buttonVariants({ variant, className }))} type={asChild ? undefined : type} {...props} />
  );
}
export { Button, buttonVariants };
