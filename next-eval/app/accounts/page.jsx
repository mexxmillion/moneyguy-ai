import AppShell from '@/components/AppShell';

export default function AccountsPage() {
  return (
    <AppShell title="Accounts" subtitle="Parallel Next shell for the existing accounts workflow. Stitch look, same data responsibilities.">
      <div className="surface-card rounded-[2rem] p-8">
        <h3 className="text-xl font-bold">Accounts eval shell</h3>
        <p className="mt-3 text-sm text-[var(--muted)]">Next step: port the current Vite accounts logic into this page while matching the imported Stitch accounts layout.</p>
      </div>
    </AppShell>
  );
}
