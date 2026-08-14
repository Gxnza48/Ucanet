'use client'

/**
 * app/_components/user-menu.tsx — el slot 5 del header (PART 17 §17.1.1).
 *
 * El disparador es el seudónimo como TEXTO, no un avatar: la identidad de este
 * producto es textual (D2 — los avatares son P2 si alguna vez), y un círculo con
 * inicial sería la firma visual que §5 prohíbe.
 *
 * Está en la lista blanca de cliente de PART 19 §19.3 ("dropdown menu"). Todo el
 * comportamiento de teclado, foco y Esc lo pone `components/ui/menu` sobre Radix;
 * acá solo se arma la lista de ítems: la de §17.1.1, más "Guardados" y más "Panel
 * de moderación" cuando el rol lo habilita.
 *
 * "Guardados" va entre "Mi perfil" y "Ajustes" y no en el chrome: los marcadores se
 * consultan cuando uno los busca, no todos los días, y el header está cerrado en
 * cinco slots (§17.1.1). Este menú sólo lo monta `site-header.tsx` cuando hay
 * sesión, así que el ítem no necesita condición propia: sin sesión no existe el
 * disparador.
 *
 * El menú es el mismo en escritorio y en mobile (§17.1.2): lo único que cambia es
 * que el seudónimo se recorta a 12 caracteres en la barra superior chica.
 */
import { ChevronDown } from 'lucide-react'
import { useTransition } from 'react'

import { Menu, type MenuItem } from '@/components/ui/menu'
import { signOutAction } from '@/features/auth/actions'
import { cn } from '@/lib/cn'
import { type Theme } from '@/lib/theme'
import { truncate } from '@/lib/utils/text'

import { applyTheme } from './theme-toggle'

/** Tope del seudónimo en la barra superior de mobile (§17.1.2). */
const MOBILE_HANDLE_MAX = 12

export function UserMenu({
  handle,
  isMod = false,
  theme,
  className,
}: {
  handle: string
  isMod?: boolean
  theme: Theme
  className?: string
}) {
  const [, startTransition] = useTransition()

  // Con tema `auto` no sabemos qué está viendo la persona, así que el ítem ofrece
  // oscuro: es el salto que alguien busca cuando abre este menú de noche. El
  // control completo de tres estados vive en Ajustes (§17.4.8).
  const targetTheme: Theme = theme === 'oscuro' ? 'claro' : 'oscuro'
  const themeLabel = targetTheme === 'oscuro' ? 'Modo oscuro' : 'Modo claro'

  const items: MenuItem[] = [
    { label: 'Mi perfil', href: `/u/${handle}` },
    { label: 'Guardados', href: '/guardados' },
    { label: 'Ajustes', href: '/ajustes' },
    ...(isMod ? [{ label: 'Panel de moderación', href: '/mod' }] : []),
    { label: themeLabel, onSelect: () => applyTheme(targetTheme) },
    {
      label: 'Cerrar sesión',
      onSelect: () => {
        startTransition(async () => {
          await signOutAction()
        })
      },
    },
  ]

  return (
    <Menu
      className={className}
      items={items}
      trigger={
        <button
          type="button"
          aria-label={`Cuenta de ${handle}`}
          className={cn(
            'inline-flex h-11 max-w-40 cursor-pointer items-center gap-1 rounded-input px-2',
            'text-m font-semibold text-text-primary hover:bg-surface-raised lg:h-9',
          )}
        >
          <span className="truncate md:hidden">{truncate(handle, MOBILE_HANDLE_MAX)}</span>
          <span className="hidden truncate md:inline">{handle}</span>
          <ChevronDown aria-hidden="true" size={16} className="shrink-0 text-text-secondary" />
        </button>
      }
    />
  )
}
