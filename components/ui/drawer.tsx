"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

// Drawer component using Dialog as base (replaces vaul)
const Drawer = DialogPrimitive.Root

const DrawerTrigger = DialogPrimitive.Trigger

const DrawerPortal = DialogPrimitive.Portal

const DrawerClose = DialogPrimitive.Close

const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DrawerOverlay.displayName = DialogPrimitive.Overlay.displayName

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    side?: "top" | "bottom" | "left" | "right"
  }
>(({ className, side = "bottom", children, ...props }, ref) => (
  <DrawerPortal>
    <DrawerOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed z-50 flex flex-col bg-background",
        side === "top" &&
          "inset-x-0 top-0 mb-24 max-h-[80vh] rounded-b-lg border-b",
        side === "bottom" &&
          "inset-x-0 bottom-0 mt-24 max-h-[80vh] rounded-t-lg border-t",
        side === "right" &&
          "inset-y-0 right-0 w-3/4 border-l sm:max-w-sm",
        side === "left" &&
          "inset-y-0 left-0 w-3/4 border-r sm:max-w-sm",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        side === "top" &&
          "data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        side === "bottom" &&
          "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        side === "right" &&
          "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
        side === "left" &&
          "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
        className
      )}
      {...props}
    >
      {side === "bottom" && (
        <div className="bg-muted mx-auto mt-4 h-2 w-[100px] shrink-0 rounded-full" />
      )}
      {children}
    </DialogPrimitive.Content>
  </DrawerPortal>
))
DrawerContent.displayName = DialogPrimitive.Content.displayName

const DrawerHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col gap-0.5 p-4 md:gap-1.5 md:text-left", className)}
    {...props}
  />
)
DrawerHeader.displayName = "DrawerHeader"

const DrawerFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("mt-auto flex flex-col gap-2 p-4", className)} {...props} />
)
DrawerFooter.displayName = "DrawerFooter"

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-foreground font-semibold", className)}
    {...props}
  />
))
DrawerTitle.displayName = DialogPrimitive.Title.displayName

const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-muted-foreground text-sm", className)}
    {...props}
  />
))
DrawerDescription.displayName = DialogPrimitive.Description.displayName

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
}
