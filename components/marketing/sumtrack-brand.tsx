import Image from "next/image";
import { cn } from "@/lib/utils";

type SumtrackBrandProps = {
  className?: string;
  priority?: boolean;
};

export function SumtrackBrand({
  className,
  priority = false,
}: SumtrackBrandProps) {
  return (
    <Image
      alt="SumTrack"
      className={cn("h-auto w-auto", className)}
      height={900}
      priority={priority}
      sizes="(max-width: 640px) 180px, 260px"
      src="/landing/logo-with-text.png"
      width={6550}
    />
  );
}
