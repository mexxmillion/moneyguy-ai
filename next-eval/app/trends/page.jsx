import AppShell from '@/components/AppShell';

export default function TrendsPage() {
  return (
    <AppShell title="Trends & Insights" subtitle="Current trend analytics in a Stitch-inspired editorial layout.">
      <div className="surface-card rounded-[2rem] p-8">
        <h3 className="text-xl font-bold">Trends eval shell</h3>
        <p className="mt-3 text-sm text-[var(--muted)]">Will preserve current chart filters/grouping and just recompose them into the imported trends layout.</p>
      </div>
    </AppShell>
  );
}
