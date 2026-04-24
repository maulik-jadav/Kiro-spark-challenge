import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PathProject",
  description: "Commute itinerary planner — compare routes by emissions, speed, and cost.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-background text-on-background min-h-screen antialiased font-body">
        {children}
      </body>
    </html>
  );
}
