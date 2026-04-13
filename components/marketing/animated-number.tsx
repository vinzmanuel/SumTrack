"use client";

import { useEffect, useRef } from "react";
import { animate, useInView } from "framer-motion";

export function AnimatedNumber({ text, className, fast }: { text: string; className?: string; fast?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "0px 0px -50px 0px" });

  const match = text.match(/^(\d+)(.*)$/);
  const value = match ? parseInt(match[1], 10) : NaN;
  const suffix = match ? match[2] : "";

  useEffect(() => {
    if (isInView && !Number.isNaN(value) && ref.current) {
      const controls = animate(0, value, {
        duration: 1.5, // Force exactly 1.5s duration so all numbers sync
        ease: "easeOut",
        onUpdate: (latest) => {
          if (ref.current) {
            ref.current.textContent = latest.toFixed(0) + suffix;
          }
        },
      });
      return () => controls.stop();
    }
  }, [isInView, value, suffix]);

  if (Number.isNaN(value)) {
    return <span className={className}>{text}</span>;
  }

  return <span ref={ref} className={className}>0{suffix}</span>;
}
