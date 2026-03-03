'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

export default function TopNav() {
    const pathname = usePathname()
    const isEtsy = pathname?.startsWith('/dashboard/etsy')

    return (
        <nav className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-md sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">{isEtsy ? '🎨' : '🦀'}</span>
                        <h1 className="text-xl font-bold bg-gradient-to-r from-orange-400 to-rose-400 bg-clip-text text-transparent">
                            Nong Kung Agency
                        </h1>
                    </div>

                    {/* Project Switcher */}
                    <div className="bg-slate-900 rounded-lg p-1 flex border border-slate-800 ml-4">
                        <Link
                            href="/dashboard"
                            className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${!isEtsy ? 'bg-emerald-600 shadow-md text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                }`}
                        >
                            📸 Influencer
                        </Link>
                        <Link
                            href="/dashboard/etsy"
                            className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${isEtsy ? 'bg-purple-600 shadow-md text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                }`}
                        >
                            🖍️ Etsy Books
                        </Link>
                    </div>
                </div>

                <div className="flex items-center gap-6 text-sm font-medium">
                    {isEtsy ? (
                        // Etsy Navigation
                        <>
                            <Link href="/dashboard/etsy" className="hover:text-purple-400 transition-colors">Books Dashboard</Link>
                            <Link href="/dashboard/etsy/settings" className="hover:text-purple-400 transition-colors">⚙️ Settings & Fonts</Link>
                        </>
                    ) : (
                        // Influencer Navigation
                        <>
                            <Link href="/dashboard" className="hover:text-orange-400 transition-colors">Dashboard</Link>
                            <Link href="/dashboard/workflows" className="hover:text-orange-400 transition-colors">Workflows</Link>
                            <Link href="/dashboard/personas" className="hover:text-orange-400 transition-colors">🧬 Personas</Link>
                            <Link href="/dashboard/prompts" className="hover:text-orange-400 transition-colors">Template Studio</Link>
                            <Link href="/dashboard/settings" className="hover:text-orange-400 transition-colors">API Settings</Link>
                            <Link href="/dashboard/analytics" className="hover:text-orange-400 transition-colors">Analytics</Link>
                            <Link href="/dashboard/logs" className="hover:text-orange-400 transition-colors">System Logs</Link>
                        </>
                    )}

                    <div className="h-8 w-8 bg-slate-800 rounded-full border border-slate-700 flex items-center justify-center">
                        👤
                    </div>
                </div>
            </div>
        </nav>
    )
}
