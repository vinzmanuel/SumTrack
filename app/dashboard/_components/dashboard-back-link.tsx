import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DashboardBackLink({
  href,
  label,
  className,
}: {
  href: string;
  label: string;
  className?: string;
}) {
  return (
    <Button
      asChild
      className={cn(
        "h-auto justify-start gap-2 px-0 text-muted-foreground hover:bg-transparent hover:text-foreground",
        className,
      )}
      size="sm"
      type="button"
      variant="ghost"
    >
      <Link href={href}>
        <ArrowLeft data-icon="inline-start" />
        {label}
      </Link>
    </Button>
  );
}
