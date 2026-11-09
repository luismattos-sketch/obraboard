import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: true,
  },
};

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  return children;
}
