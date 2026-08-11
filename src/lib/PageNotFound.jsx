import { Link } from "react-router-dom";

export default function PageNotFound() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-3 bg-background text-center px-6">
      <h1 className="font-heading text-2xl text-foreground">Page not found</h1>
      <p className="text-sm text-muted-foreground max-w-xs">
        This page doesn't exist, or you don't have access to it.
      </p>
      <Link to="/" className="mt-2 text-sm font-medium text-accent hover:underline">
        ← Back to Home
      </Link>
    </div>
  );
}
