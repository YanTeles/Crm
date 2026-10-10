"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function SubmitButton({
  pending,
  children,
  className,
  variant,
  size,
}: {
  pending: boolean;
  children: React.ReactNode;
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
}) {
  return (
    <Button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={className}
      variant={variant}
      size={size}
    >
      {pending ? <Spinner /> : null}
      {children}
    </Button>
  );
}
