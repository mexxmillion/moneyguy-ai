import AppShell from '@/components/AppShell';

export default function UploadPage() {
  return (
    <AppShell title="Inbound" subtitle="Same upload queue and processing flow, re-skinned with the Stitch ingestion screen language.">
      <div className="surface-card rounded-[2rem] p-8">
        <h3 className="text-xl font-bold">Upload eval shell</h3>
        <p className="mt-3 text-sm text-[var(--muted)]">Will keep drag/drop queue behavior from the Vite app and map it into the imported ingestion screen.</p>
      </div>
    </AppShell>
  );
}
