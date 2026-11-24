"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-[#36634b]" />,
        info: <InfoIcon className="size-4 text-[#76685e]" />,
        warning: <TriangleAlertIcon className="size-4 text-[#806322]" />,
        error: <OctagonXIcon className="size-4 text-[#aa3931]" />,
        loading: <Loader2Icon className="size-4 animate-spin text-[#c79d68]" />,
      }}
      style={
        {
          "--normal-bg": "#ffffff",
          "--normal-text": "#302822",
          "--normal-border": "#e9dfd2",
          "--border-radius": "10px",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
