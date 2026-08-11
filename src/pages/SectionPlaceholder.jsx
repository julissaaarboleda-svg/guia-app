export default function SectionPlaceholder({ title = "Coming soon" }) {
  return (
    <div className="p-8 text-center text-muted-foreground">
      <p className="font-heading text-lg text-foreground mb-1">{title}</p>
      <p className="text-sm">This section isn't wired up yet.</p>
    </div>
  );
}
