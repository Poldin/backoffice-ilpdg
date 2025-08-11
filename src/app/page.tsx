import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen p-8 flex items-center justify-center">
      <div className="max-w-xl text-center space-y-4">
        <h1 className="text-3xl font-semibold">Backoffice - ilPDG</h1>
        <p className="text-black/70 dark:text-white/70">
          Benvenuto nel pannello di amministrazione. Per continuare, effettua l&apos;accesso.
        </p>
        <div>
          <Link href="/login" className="inline-block bg-black text-white px-5 py-2 rounded">
            Vai al login
          </Link>
        </div>
      </div>
    </div>
  );
}
