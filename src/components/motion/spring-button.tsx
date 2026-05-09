"use client";

import * as React from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";

/* ─────────────────────────────────────────────────────────────────────────────
   SpringButton
   Wraps any button-like element with a subtle press-down / lift-up spring so
   interactive cards and primary actions feel physical without shifting layout.
───────────────────────────────────────────────────────────────────────────── */

export interface SpringButtonProps extends HTMLMotionProps<"div"> {
  /** Scale applied while the pointer is pressed. Default 0.96 */
  pressScale?: number;
  /** Scale applied while the pointer hovers. Default 1.025 */
  hoverScale?: number;
  /** Extra shadow glow on hover – pass a CSS box-shadow string. */
  hoverShadow?: string;
}

export function SpringButton({
  pressScale = 0.96,
  hoverScale = 1.025,
  hoverShadow,
  style,
  ...props
}: SpringButtonProps) {
  const reduced = useReducedMotion();

  if (reduced) {
    return <motion.div style={style} {...props} />;
  }

  return (
    <motion.div
      whileHover={{
        scale: hoverScale,
        boxShadow: hoverShadow ?? "0 8px 24px rgba(0,0,0,0.22)"
      }}
      whileTap={{ scale: pressScale }}
      transition={{ type: "spring", stiffness: 360, damping: 26 }}
      style={style}
      {...props}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   PanelSlide
   Animates a panel / drawer / side-sheet sliding in from the right or bottom.
───────────────────────────────────────────────────────────────────────────── */

export interface PanelSlideProps extends HTMLMotionProps<"div"> {
  direction?: "right" | "bottom" | "left";
  distance?: number;
}

export function PanelSlide({ direction = "right", distance = 32, ...props }: PanelSlideProps) {
  const reduced = useReducedMotion();

  const axis =
    direction === "right" ? { x: distance } : direction === "left" ? { x: -distance } : { y: distance };

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, ...axis }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={reduced ? undefined : { opacity: 0, ...axis }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      {...props}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   ScaleFade
   Quick scale+fade entrance for modal content, cards, and tooltips.
───────────────────────────────────────────────────────────────────────────── */

export interface ScaleFadeProps extends HTMLMotionProps<"div"> {
  initialScale?: number;
}

export function ScaleFade({ initialScale = 0.94, ...props }: ScaleFadeProps) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, scale: initialScale }}
      animate={{ opacity: 1, scale: 1 }}
      exit={reduced ? undefined : { opacity: 0, scale: initialScale }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      {...props}
    />
  );
}
