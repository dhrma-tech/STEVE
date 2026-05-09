"use client";

import * as React from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";

export type PageTransitionProps = HTMLMotionProps<"main">;

export function PageTransition({ transition, ...props }: PageTransitionProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.main
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduceMotion ? undefined : { opacity: 0 }}
      transition={{ duration: 0.22, ease: "easeOut", ...transition }}
      {...props}
    />
  );
}

