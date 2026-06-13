import { Suspense } from "react";

import ProfilePageClient from "./ProfilePageClient";

export default function ProfilePage() {
  return (
    <Suspense fallback={<p className="muted">Loading profile...</p>}>
      <ProfilePageClient />
    </Suspense>
  );
}
