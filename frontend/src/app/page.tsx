import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="max-w-3xl text-center">
        <h1 className="text-5xl font-bold tracking-tight mb-6">
          Take Back Your Data
        </h1>
        <p className="text-xl text-muted-foreground mb-8">
          Libertas is an open-source platform that liberates your data from
          Notion, Airtable, Google Sheets, and more. Export to SQLite, JSON, or
          CSV with complete ownership.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/login">
            <Button size="lg">Get Started</Button>
          </Link>
          <Link href="https://github.com/data-liberation/platform" target="_blank">
            <Button variant="outline" size="lg">
              View on GitHub
            </Button>
          </Link>
        </div>
      </div>

      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl">
        <div className="p-6 border rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Connect</h3>
          <p className="text-muted-foreground">
            Link your Notion, Airtable, or Google Sheets accounts with secure
            OAuth authentication.
          </p>
        </div>
        <div className="p-6 border rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Export</h3>
          <p className="text-muted-foreground">
            Select the databases and pages you want to export. We preserve all
            relations and metadata.
          </p>
        </div>
        <div className="p-6 border rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Own</h3>
          <p className="text-muted-foreground">
            Download a SQLite database or JSON files that you fully control.
            Query with any tool.
          </p>
        </div>
      </div>
    </main>
  );
}
