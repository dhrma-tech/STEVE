"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils/cn";

/* ─────────────────────────────────────────────────────────────────────────────
   AnimatedList
   A list container that staggers children in as they mount, and animates them
   out when they unmount. Wraps an <ul> or a <div> depending on `as` prop.
───────────────────────────────────────────────────────────────────────────── */

export interface AnimatedListProps {
  children: React.ReactNode;
  as?: "ul" | "ol" | "div";
  className?: string;
  staggerSeconds?: number;
  /** Delay before the first item enters. Default 0 */
  initialDelay?: number;
}

export function AnimatedList({
  children,
  as: Tag = "div",
  className,
  staggerSeconds = 0.07,
  initialDelay = 0
}: AnimatedListProps) {
  const reduced = useReducedMotion();
  const items = React.Children.toArray(children);

  return (
    <Tag className={className}>
      <AnimatePresence initial mode="popLayout">
        {items.map((item, index) => (
          <AnimatedListItem
            key={(item as React.ReactElement).key ?? index}
            delay={reduced ? 0 : initialDelay + index * staggerSeconds}
          >
            {item}
          </AnimatedListItem>
        ))}
      </AnimatePresence>
    </Tag>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   AnimatedListItem
   Individual item wrapper. Uses layout animation so inserting / removing items
   at any position smoothly rearranges siblings without layout shift.
───────────────────────────────────────────────────────────────────────────── */

export interface AnimatedListItemProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

export function AnimatedListItem({ children, delay = 0, className }: AnimatedListItemProps) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      layout
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? undefined : { opacity: 0, y: -6, transition: { duration: 0.16 } }}
      transition={{
        layout: { type: "spring", stiffness: 340, damping: 28 },
        opacity: { duration: 0.28, ease: [0.22, 1, 0.36, 1], delay },
        y: { duration: 0.28, ease: [0.22, 1, 0.36, 1], delay }
      }}
      className={cn("contents", className)}
    >
      {children}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   AgentPulseDot
   A pulsating status indicator dot used on running/active agent cards.
───────────────────────────────────────────────────────────────────────────── */

export interface AgentPulseDotProps {
  color?: string;
  /** Size in pixels. Default 8. */
  size?: number;
  className?: string;
}

export function AgentPulseDot({ color = "#86efac", size = 8, className }: AgentPulseDotProps) {
  const reduced = useReducedMotion();

  return (
    <span className={cn("relative inline-flex", className)} style={{ width: size, height: size }}>
      {!reduced && (
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ backgroundColor: color, opacity: 0.55 }}
          animate={{ scale: [1, 1.9, 1], opacity: [0.55, 0, 0.55] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      <span
        className="relative inline-flex rounded-full"
        style={{ width: size, height: size, backgroundColor: color }}
      />
    </span>
  );
}
