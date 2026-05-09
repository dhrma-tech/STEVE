"use client";

import * as React from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";

export interface StaggerProps extends HTMLMotionProps<"div"> {
  delayChildren?: number;
  staggerChildren?: number;
}

export function Stagger({ delayChildren = 0, staggerChildren = 0.08, transition, ...props }: StaggerProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : "hidden"}
      animate="show"
      variants={{
        hidden: {},
        show: {
          transition: {
            delayChildren,
            staggerChildren,
            ...transition
          }
        }
      }}
      {...props}
    />
  );
}

export interface StaggerItemProps extends HTMLMotionProps<"div"> {
  y?: number;
}

export function StaggerItem({ y = 12, transition, ...props }: StaggerItemProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      variants={
        reduceMotion
          ? undefined
          : {
              hidden: { opacity: 0, y },
              show: { opacity: 1, y: 0, transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1], ...transition } }
            }
      }
      {...props}
    />
  );
}

