"use client";

import { useRef } from "react";
import { useInView } from "framer-motion";
import { MapPin } from "lucide-react";

export function MapFacade({ className, src, title }: { className?: string; src: string; title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "200px" });

  if (isInView) {
    return (
      <iframe
        className={className}
        src={src}
        title={title}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    );
  }

  return (
    <div
      ref={ref}
      className={`relative flex items-center justify-center bg-[#0d131f] ${className}`}
    >
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <div className="relative z-10 flex flex-col items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f0a818]/10 text-[#f0a818] shadow-[0_0_20px_rgba(240,168,24,0.2)]">
          <MapPin className="h-6 w-6 animate-pulse" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
          Loading Map...
        </span>
      </div>
    </div>
  );
}
