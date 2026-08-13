'use client'

// components/ui/menu.tsx — PART 18 §18.4 fila 14 ("Menú").
// Radix DropdownMenu (PART 19 §19.5): foco en roving tabindex, escritura para buscar,
// cierre con Esc y retorno del foco al trigger. No tocamos nada de eso.

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import Link from 'next/link'
import { isValidElement, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type MenuItem = {
  label: string
  href?: string
  onSelect?: () => void
  danger?: boolean
}

// 44px de alto en mobile (PART 17 §17.7 objetivos táctiles), 36px de sm en adelante.
const ITEM_CLASS =
  'flex h-11 cursor-default items-center rounded-input px-3 text-m select-none data-highlighted:bg-surface-raised data-disabled:opacity-40 sm:h-9'

export function Menu({
  trigger,
  items,
  className,
}: {
  trigger: ReactNode
  items: MenuItem[]
  className?: string
}) {
  return (
    <DropdownMenu.Root>
      {isValidElement(trigger) ? (
        <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      ) : (
        <DropdownMenu.Trigger>{trigger}</DropdownMenu.Trigger>
      )}

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          collisionPadding={8}
          loop
          className={cn(
            'z-50 min-w-45 rounded-container border border-border bg-bg p-2 shadow-overlay',
            'transition duration-150 ease-out starting:translate-y-0.5 starting:opacity-0',
            className,
          )}
        >
          {items.map((item, index) => {
            const tone = item.danger ? 'text-danger' : 'text-text-primary'

            // Ítem-link: el <a> es el propio ítem (asChild), así Enter navega y no
            // quedan anclas anidadas dentro de un div con role="menuitem".
            if (item.href !== undefined) {
              return (
                <DropdownMenu.Item
                  key={`${item.label}-${index}`}
                  asChild
                  onSelect={item.onSelect}
                  className={cn(ITEM_CLASS, tone)}
                >
                  <Link href={item.href}>{item.label}</Link>
                </DropdownMenu.Item>
              )
            }

            return (
              <DropdownMenu.Item
                key={`${item.label}-${index}`}
                onSelect={item.onSelect}
                className={cn(ITEM_CLASS, tone)}
              >
                {item.label}
              </DropdownMenu.Item>
            )
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
