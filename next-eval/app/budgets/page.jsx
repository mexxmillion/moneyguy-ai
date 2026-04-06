import AppShell from '@/components/AppShell';

export default function BudgetsPage() {
  return (
    <AppShell title="Budget" subtitle="Same budget workflow, fresh visual treatment from the Stitch budgeting screen.">
      <div className="surface-card rounded-[2rem] p-8">
        <h3 className="text-xl font-bold">Budget eval shell</h3>
        <p className="mt-3 text-sm text-[var(--muted)]">Will preserve current budget CRUD and progress logic — just remapped into the new card/progress language.</p>
      </div>
    </AppShell>
  );
}
