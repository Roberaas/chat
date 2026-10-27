'use client'
import { createContext, useContext, type ReactNode } from 'react'
import type { CrmContext } from '@/lib/crm/types'
import { can } from '@/lib/crm/types'

const Ctx = createContext<CrmContext | null>(null)

export function CrmProvider({ value, children }: { value: CrmContext; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
export function useCrm() {
  const c = useContext(Ctx)
  if (!c) throw new Error('CrmProvider eksik')
  return { ...c, can: (perm: string) => can(c, perm) }
}
