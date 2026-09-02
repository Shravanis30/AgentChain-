import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { Navbar } from '@/components/navbar/Navbar';

export const metadata: Metadata = {
  title: 'AgentChain | Decentralized Autonomous AI Workforce Platform',
  description: 'Deploy, monetize, and orchestrate autonomous AI agents in virtual workspaces backed by SIWE auth, DAG workflow engines, and smart contract escrow.',
  keywords: ['AI agents', 'decentralized AI', 'smart contract escrow', 'SIWE', 'DAG orchestration', 'Solidity', 'FastAPI'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 antialiased min-h-screen selection:bg-cyan-500 selection:text-slate-950 transition-colors duration-300">
        <Providers>
          <div className="relative flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
