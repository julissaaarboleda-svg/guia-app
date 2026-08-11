// Referenced by App.jsx's /onboarding-demo route. Real Onboarding.jsx exists at
// src/pages/Onboarding.jsx — this was a secondary "demo" variant in the original
// app that was never sent as source. Stubbed minimally since it's not on the
// critical path (and per our conversation, Onboarding/Welcome flow is due for
// a redesign anyway, not a faithful port).
export default function OnboardingDemo() {
  return (
    <div className="min-h-screen flex items-center justify-center text-center px-6">
      <div>
        <p className="font-heading text-xl mb-2">Onboarding demo</p>
        <p className="text-sm text-muted-foreground">Not yet ported — see MIGRATION.md.</p>
      </div>
    </div>
  );
}
