import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import './globals.css';

export const metadata: Metadata = {
  title: 'Project Vigil — Daily Intelligence Brief',
  description:
    'Bias-tracked, corroborated open-source intelligence across Local, National, and Geopolitical sectors. Delivered at 6am CT every morning.',
  openGraph: {
    title: 'Project Vigil',
    description: 'Know before the crowd does.',
    url: 'https://initiativevigil.com',
    siteName: 'Project Vigil',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <Nav />
          {children}
          <Footer />
        </body>
      </html>
    </ClerkProvider>
  );
}
