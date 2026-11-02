'use client'

import type * as React from 'react'
import { Sheet, SheetDescription, SheetHeader, SheetPopup, SheetTitle } from '@/components/ui/sheet'

const SIDEBAR_WIDTH_MOBILE: string = '18rem'

/**
 * Mobile branch of <Sidebar> (a Base UI Dialog drawer). Split out of sidebar.tsx and loaded with next/dynamic,
 * so desktop pages do not download the Dialog code (DECISIONS 10.2 First Load JS budget).
 */
export default function SidebarMobileSheet({
  side,
  open,
  onOpenChange,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  side: 'left' | 'right'
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.ReactElement {
  return (
    <Sheet onOpenChange={onOpenChange} open={open} {...props}>
      <SheetPopup
        className="w-(--sidebar-width) bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"
        data-mobile="true"
        data-sidebar="sidebar"
        data-slot="sidebar"
        side={side}
        style={
          {
            '--sidebar-width': SIDEBAR_WIDTH_MOBILE,
          } as React.CSSProperties
        }
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Menu</SheetTitle>
          <SheetDescription>Điều hướng chính của trang.</SheetDescription>
        </SheetHeader>
        <div className="flex h-full w-full flex-col">{children}</div>
      </SheetPopup>
    </Sheet>
  )
}
