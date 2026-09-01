/**
 * What is filled in for the month, as data. The month form is long enough that
 * saving feels like a leap of faith, so the same field descriptors that build
 * the form also build a progress checklist next to it.
 */

import { INPUT_GROUPS } from './fields.ts'
import type { Inputs } from './types.ts'

export type ChecklistItem = {
  key: string
  label: string
  done: boolean
  /** Optional items are shown, but never hold the progress bar back. */
  optional?: boolean
}

export type ChecklistSection = {
  id: string
  title: string
  items: readonly ChecklistItem[]
  /** Every required item in the section is filled in. */
  done: boolean
}

const sectionDone = (items: readonly ChecklistItem[]): boolean =>
  items.every((item) => item.done || item.optional === true)

export function buildChecklist(
  inputs: Inputs,
  touched: ReadonlySet<keyof Inputs>,
): readonly ChecklistSection[] {
  const head: ChecklistItem[] = [
    { key: 'month', label: 'Mes elegido', done: inputs.month !== '' },
    { key: 'stage', label: 'Etapa del server', done: touched.has('stage') },
  ]
  const groups = INPUT_GROUPS.map((group) => {
    const items = group.fields.map(
      (field): ChecklistItem => ({
        key: field.key,
        label: field.label,
        done: touched.has(field.key),
      }),
    )
    return { id: group.title, title: group.title, items, done: sectionDone(items) }
  })
  const tail: ChecklistItem[] = [
    { key: 'notes', label: 'Notas del mes', done: inputs.notes.trim() !== '', optional: true },
  ]
  return [
    { id: 'mes', title: 'Mes', items: head, done: sectionDone(head) },
    ...groups,
    { id: 'notas', title: 'Notas', items: tail, done: sectionDone(tail) },
  ]
}

export type Progress = { done: number; total: number; pct: number }

/** Counts required items only. Optional ones never move the bar. */
export function checklistProgress(sections: readonly ChecklistSection[]): Progress {
  const required = sections.flatMap((section) =>
    section.items.filter((item) => item.optional !== true),
  )
  const done = required.filter((item) => item.done).length
  const total = required.length
  return { done, total, pct: total === 0 ? 100 : (done / total) * 100 }
}
