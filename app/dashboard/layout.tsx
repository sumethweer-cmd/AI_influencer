import React from 'react'
import QueueManager from '@/app/dashboard/components/QueueManager'
import TopNav from '@/app/dashboard/components/TopNav'

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 font-sans">
            <TopNav />
            <main className="max-w-7xl mx-auto px-4 py-8 relative">
                {children}
            </main>
            <QueueManager />
        </div>
    )
}
