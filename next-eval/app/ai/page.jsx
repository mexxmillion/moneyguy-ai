import AppShell from '@/components/AppShell';

export default function AIPage() {
  return (
    <AppShell title="AI Query" subtitle="Natural-language money search, same backend endpoint, less crusty presentation.">
      <div className="surface-card rounded-[2rem] p-8">
        <h3 className="text-xl font-bold">AI eval shell</h3>
        <p className="mt-3 text-sm text-[var(--muted)]">Will wire into /api/ai/query and preserve suggestion prompts/results table from the Vite app.</p>
      </div>
    </AppShell>
  );
}
