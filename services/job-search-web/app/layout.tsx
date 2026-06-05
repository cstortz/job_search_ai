import type { Metadata } from "next";
import Link from "next/link";

import "./globals.css";

export const metadata: Metadata = {
  title: "Job Search Web",
  description: "Job Search AI frontend",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header style={{ background: "#111827", color: "#fff" }}>
          <div className="container row space-between">
            <strong>Job Search AI</strong>
            <nav className="row">
              <Link href="/profile">Profile</Link>
              <Link href="/jobs">Jobs</Link>
              <Link href="/job-sites">Job Sites</Link>
              <Link href="/skills">Skills</Link>
              <Link href="/docs" target="_blank">
                API Docs
              </Link>
              <Link href="/auth/login">Login</Link>
              <Link href="/auth/logout">Logout</Link>
            </nav>
          </div>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
