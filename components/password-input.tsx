"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function PasswordInput({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "type">) {
  const [isVisible, setIsVisible] = React.useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        className={cn("pr-11", className)}
        type={isVisible ? "text" : "password"}
      />
      <Button
        aria-label={isVisible ? "Hide password" : "Show password"}
        className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        size="icon-sm"
        type="button"
        variant="ghost"
        onClick={() => setIsVisible((current) => !current)}
      >
        {isVisible ? <EyeOff /> : <Eye />}
      </Button>
    </div>
  );
}
