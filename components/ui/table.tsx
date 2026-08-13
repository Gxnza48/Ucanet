/**
 * components/ui/table.tsx — PART 18 §18.4 fila 16, "Tabla mod".
 *
 * La tabla utilitaria del panel de moderación: celdas de 13px, padding 8×12, hairline por fila,
 * header pegajoso con fondo raised. Debajo de 1024px el scroll horizontal vive en el contenedor,
 * nunca en la página (PART 17 §17.6). Desde `lg` (1024px) el overflow vuelve a `visible` para que
 * el header pegajoso se ancle al scroll de la página y no a una caja sin scroll vertical.
 *
 * Columnas ordenables: pasá un `<button>` dentro de `TableHeaderCell` y `aria-sort` en la celda.
 */
import type { HTMLAttributes, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export function Table({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto lg:overflow-x-visible">
      <table className={cn('w-full text-s text-text-primary', className)} {...props} />
    </div>
  )
}

export function TableHead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('text-left', className)} {...props} />
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={className} {...props} />
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('border-b border-border', className)} {...props} />
}

export function TableHeaderCell({
  className,
  scope,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope={scope ?? 'col'}
      className={cn(
        // El nowrap del header le da a la tabla su ancho natural: es lo que dispara
        // el scroll del contenedor en pantallas angostas.
        'sticky top-0 z-10 whitespace-nowrap border-b border-border bg-surface-raised px-3 py-2',
        'text-left font-semibold text-text-primary',
        className,
      )}
      {...props}
    />
  )
}

export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-3 py-2 align-top', className)} {...props} />
}
