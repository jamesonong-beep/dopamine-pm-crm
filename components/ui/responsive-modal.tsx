"use client"

import * as React from "react"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { cn } from "@/lib/utils"

interface ResponsiveModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
  className?: string
  dismissible?: boolean
}

/**
 * Accessible shadcn/ui Dialog on desktop (>=768px) and Vaul drag-to-close Drawer on mobile (<768px).
 */
export function ResponsiveModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  dismissible = true,
}: ResponsiveModalProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Drawer
        open={open}
        onOpenChange={(next) => {
          if (!dismissible && !next) return
          onOpenChange(next)
        }}
        dismissible={dismissible}
      >
        <DrawerContent
          className={cn(
            "max-h-[92vh] bg-[#fcf9f2] text-[#302822] border-[#e9dfd2]",
            className
          )}
        >
          <DrawerHeader className="border-b border-[#e9dfd2] text-left">
            <DrawerTitle className="text-[#302822]">{title}</DrawerTitle>
            {description && (
              <DrawerDescription className="text-[#76685e]">
                {description}
              </DrawerDescription>
            )}
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6 pt-3">{children}</div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!dismissible && !next) return
        onOpenChange(next)
      }}
    >
      <DialogContent
        showCloseButton={dismissible}
        className={cn(
          "max-h-[90vh] overflow-y-auto sm:max-w-[620px] bg-white text-[#302822] border-[#e9dfd2]",
          className
        )}
      >
        <DialogHeader className="border-b border-[#e9dfd2] pb-3">
          <DialogTitle className="text-[#302822]">{title}</DialogTitle>
          {description && (
            <DialogDescription className="text-[#76685e]">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="pt-1">{children}</div>
      </DialogContent>
    </Dialog>
  )
}
