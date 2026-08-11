import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="bottom-center"
      toastOptions={{
        style: {
          background: "hsl(var(--card))",
          color: "hsl(var(--foreground))",
          border: "1px solid hsl(var(--border))",
        },
      }}
    />
  );
}
