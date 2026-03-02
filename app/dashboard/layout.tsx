import React from 'react'
import QueueManager from '@/app/dashboard/components/QueueManager'

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 font-sans">
            <nav className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">🦀</span>
                        <h1 className="text-xl font-bold bg-gradient-to-r from-orange-400 to-rose-400 bg-clip-text text-transparent">
                            Nong Kung Agency
                        </h1>
                    </div>
                    <div className="flex items-center gap-6 text-sm font-medium">
                        <a href="/dashboard" className="hover:text-orange-400 transition-colors">Dashboard</a>
                        <a href="/dashboard/workflows" className="hover:text-orange-400 transition-colors">Workflows</a>
                        <a href="/dashboard/personas" className="hover:text-orange-400 transition-colors">🧬 Personas</a>
                        <a href="/dashboard/prompts" className="hover:text-orange-400 transition-colors">Template Studio</a>
                        <a href="/dashboard/settings" className="hover:text-orange-400 transition-colors">API Settings</a>
                        <a href="/dashboard/analytics" className="hover:text-orange-400 transition-colors">Analytics</a>
                        <a href="/dashboard/logs" className="hover:text-orange-400 transition-colors">System Logs</a>
                        <div className="h-8 w-8 bg-slate-800 rounded-full border border-slate-700 flex items-center justify-center">
                            👤
                        </div>
                    </div>
                </div>
            </nav>
            <main className="max-w-7xl mx-auto px-4 py-8 relative">
                {children}
            </main>
            <QueueManager />
        </div>
    )
}
