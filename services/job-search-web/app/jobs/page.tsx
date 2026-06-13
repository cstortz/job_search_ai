import { Suspense } from "react";

import JobsPageClient from "./JobsPageClient";

export default function JobsPage() {
  return (
    <Suspense fallback={<p className="muted">Loading jobs...</p>}>
      <JobsPageClient />
    </Suspense>
  );
}
