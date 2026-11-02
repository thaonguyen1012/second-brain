'use client'

import type * as React from 'react'
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * Tooltip branch of <SidebarMenuButton tooltip>. Split out of sidebar.tsx and loaded with next/dynamic,
 * so pages whose sidebar has no tooltips do not download the Tooltip and positioning code.
 */
export default function SidebarMenuTooltip({
  button,
  hidden,
  tooltip,
}: {
  button: React.ReactElement
  hidden: boolean
  tooltip: React.ComponentProps<typeof TooltipPopup>
}): React.ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger render={button as React.ReactElement<Record<string, unknown>>} />
      <TooltipPopup align="center" hidden={hidden} side="right" {...tooltip} />
    </Tooltip>
  )
}
