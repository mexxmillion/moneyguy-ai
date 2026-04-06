import AppShell from '@/components/AppShell';

export default function TransactionsPage() {
  return (
    <AppShell title="Transactions" subtitle="Existing filter/search/review workflow, restyled against the Stitch transaction table aesthetic.">
      <div className="surface-card rounded-[2rem] p-8">
        <h3 className="text-xl font-bold">Transactions eval shell</h3>
        <p className="mt-3 text-sm text-[var(--muted)]">Will keep the Vite transaction workflow intact: filters, AI categorize, export, and table controls.</p>
      </div>
    </AppShell>
  );
}
