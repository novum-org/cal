/**
 * Shared motion vocabulary. Everything animates on the same Hermite curve
 * (smoothstep, 3t² - 2t³) so transitions across the app feel like one system.
 */

import type { Transition, Variants } from 'motion/react'

/** Hermite smoothstep as a cubic-bezier: symmetric, no overshoot. */
export const HERMITE = [0.33, 0, 0.67, 1] as [number, number, number, number]
/** Its decelerating half, for things that enter and stay. */
export const HERMITE_OUT = [0.16, 1, 0.3, 1] as [number, number, number, number]

export const SWAP: Transition = { duration: 0.22, ease: HERMITE }
export const SETTLE: Transition = { duration: 0.32, ease: HERMITE_OUT }
export const SPRING: Transition = { type: 'spring', stiffness: 420, damping: 36, mass: 0.7 }

/** Page enter/exit. Direction is vertical so the tab bar reads as the anchor. */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: SETTLE },
}

/** Container that reveals its children one after the other. */
export const listVariants: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.045, delayChildren: 0.02 } },
}

export const itemVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: SETTLE },
}
