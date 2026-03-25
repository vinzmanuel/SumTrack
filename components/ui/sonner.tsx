"use client";

import { Toaster as Sonner, toast, type ToasterProps } from "sonner";

function Toaster(props: ToasterProps) {
  return <Sonner closeButton position="bottom-right" richColors {...props} />;
}

export { Toaster, toast };
