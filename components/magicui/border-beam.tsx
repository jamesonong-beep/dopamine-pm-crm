"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface BorderBeamProps {
  className?: string
  size?: number
  duration?: number
  delay?: number
  colorFrom?: string
  colorTo?: string
  borderWidth?: number
}

/**
 * Magic UI BorderBeam — pure CSS/Tailwind implementation.
 * Follow the "One-Standout Rule": use at most one animated standout element per page.
 */
export function BorderBeam({
  className,
  size = 180,
  duration = 10,
  delay = 0,
  colorFrom = "#C79D68",
  colorTo = "#AA3931",
  borderWidth = 1.5,
}: BorderBeamProps) {
  return (
    <div
      aria-hidden="true"
      style={
        {
          "--beam-size": `${size}px`,
          "--beam-duration": `${duration}s`,
          "--beam-delay": `-${delay}s`,
          "--beam-color-from": colorFrom,
          "--beam-color-to": colorTo,
          "--beam-border-width": `${borderWidth}px`,
        } as React.CSSProperties
      }
      className={cn(
        "dopamine-border-beam pointer-events-none absolute inset-0 rounded-[inherit]",
        className
      )}
    />
  )
}
