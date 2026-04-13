"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 40, filter: "blur(4px)" }}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
      viewport={{ once: true, margin: "-50px" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
    >
      {children}
    </motion.div>
  );
}

export function HeroReveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, scale: 0.95, y: 30, filter: "blur(8px)" }}
      transition={{ duration: 1, delay, ease: [0.16, 1, 0.3, 1] }}
      viewport={{ once: true }}
      whileInView={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
    >
      {children}
    </motion.div>
  );
}

export function HoverCardWrapper({ children, className, style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <motion.div
      className={className}
      style={style}
      transition={{ duration: 0.4, ease: "easeOut" }}
      whileHover={{ y: -8, scale: 1.02 }}
    >
      {children}
    </motion.div>
  );
}

import Image, { ImageProps } from "next/image";
import { useState } from "react";

type FadeInImageProps = ImageProps & { alt: string };

export function FadeInImage(props: FadeInImageProps) {
  const [loaded, setLoaded] = useState(false);
  const { alt, className, onLoad, ...imageProps } = props;

  return (
    <Image
      {...imageProps}
      alt={alt}
      onLoad={(e) => {
        setLoaded(true);
        if (onLoad) onLoad(e);
      }}
      className={`${className || ""} duration-[1.5s] ease-[cubic-bezier(0.16,1,0.3,1)] transition-all ${
        loaded ? "opacity-100 blur-0" : "scale-105 opacity-0 blur-sm"
      }`}
    />
  );
}
