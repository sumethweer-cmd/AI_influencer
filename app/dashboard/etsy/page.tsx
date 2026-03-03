'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'

export default function EtsyDashboard() {
    const [books, setBooks] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [creating, setCreating] = useState(false)

    // New Book Form
    const [title, setTitle] = useState('')
    const [theme, setTheme] = useState('')
    const [targetAge, setTargetAge] = useState('4-6 years')
    const [totalPages, setTotalPages] = useState(8)

    useEffect(() => {
        fetchBooks()
    }, [])

    const fetchBooks = async () => {
        try {
            const res = await fetch('/api/etsy/books').then(r => r.json())
            if (res.success) setBooks(res.data)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const handleCreateBook = async (e: React.FormEvent) => {
        e.preventDefault()
        setCreating(true)
        try {
            const res = await fetch('/api/etsy/books', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, theme, target_age: targetAge, total_pages: totalPages })
            }).then(r => r.json())

            if (res.success) {
                setShowModal(false)
                // Redirect to book editor
                window.location.href = `/dashboard/etsy/books/${res.data.id}`
            } else {
                alert('Error creating book: ' + res.error)
            }
        } catch (e: any) {
            alert('Error: ' + e.message)
        }
        setCreating(false)
    }

    const totalSales = books.reduce((sum, b) => sum + (Number(b.total_sales) || 0), 0)
    const estRevenue = books.reduce((sum, b) => sum + ((Number(b.total_sales) || 0) * (Number(b.price) || 0)), 0)

    if (loading) return <div className="p-8">Loading books...</div>

    return (
        <div className="flex flex-col gap-8">
            <header className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold">🖍️ Etsy Coloring Books</h2>
                    <p className="text-slate-400 mt-1">Manage, generate, and export your children's storybooks.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setShowModal(true)}
                        className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 rounded-xl text-sm font-black flex items-center gap-2 transition-all shadow-lg shadow-purple-500/20"
                    >
                        <span>+</span> Create New Book
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <h3 className="text-slate-400 text-sm font-bold tracking-wider">TOTAL BOOKS</h3>
                    <p className="text-4xl font-black mt-2">{books.length}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <h3 className="text-slate-400 text-sm font-bold tracking-wider">TOTAL SALES</h3>
                    <p className="text-4xl font-black text-emerald-400 mt-2">{totalSales} <span className="text-sm font-medium text-slate-500">copies</span></p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <h3 className="text-slate-400 text-sm font-bold tracking-wider">EST. REVENUE</h3>
                    <p className="text-4xl font-black text-amber-400 mt-2">${estRevenue.toFixed(2)}</p>
                </div>
            </div>

            {books.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 flex flex-col items-center justify-center text-center">
                    <span className="text-6xl mb-6 opacity-80">📖</span>
                    <h3 className="text-2xl font-bold text-slate-200">No Books Found</h3>
                    <p className="text-slate-400 mt-2 max-w-md">
                        Start a new project by clicking "Create New Book" above.
                        AI will automatically generate stories and layout templates for you.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {books.map(book => (
                        <Link href={`/dashboard/etsy/books/${book.id}`} key={book.id} className="group">
                            <div className="bg-slate-900 overflow-hidden border border-slate-800 hover:border-purple-500 rounded-2xl transition-colors h-full flex flex-col">
                                <div className="h-40 bg-slate-950 flex flex-col items-center justify-center border-b border-slate-800 p-4 text-center group-hover:bg-slate-800 transition-colors">
                                    <span className="text-5xl opacity-80 mb-2">🎨</span>
                                    <h4 className="font-bold text-slate-200 line-clamp-2">{book.title}</h4>
                                </div>
                                <div className="p-4 flex-grow flex flex-col justify-between">
                                    <div className="text-xs text-slate-400 flex flex-col gap-2">
                                        <div className="flex justify-between">
                                            <span>Age: {book.target_age}</span>
                                            <span>{book.total_pages} Pages</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Theme: {book.theme || 'General'}</span>
                                            <span className={`px-2 py-0.5 rounded font-bold ${book.status === 'Draft' ? 'bg-slate-800 text-slate-300' :
                                                    book.status === 'Generating' ? 'bg-amber-900/50 text-amber-400 animate-pulse' :
                                                        book.status === 'Completed' ? 'bg-emerald-900/50 text-emerald-400' :
                                                            'bg-purple-900/50 text-purple-400'
                                                }`}>
                                                {book.status}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center text-xs">
                                        <span className="text-emerald-400 font-bold">{book.total_sales || 0} sold</span>
                                        <span className="text-amber-400 font-bold">${book.price || '0.00'}</span>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {/* Create Book Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                            <h3 className="text-xl font-bold">Create New Book</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">✕</button>
                        </div>
                        <form onSubmit={handleCreateBook} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-400 mb-1">Book Title</label>
                                <input
                                    type="text"
                                    required
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder="e.g. Magical Forest Animals"
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm focus:border-purple-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-400 mb-1">Theme (Optional)</label>
                                <input
                                    type="text"
                                    value={theme}
                                    onChange={e => setTheme(e.target.value)}
                                    placeholder="e.g. Cute animals, learning alphabets..."
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm focus:border-purple-500 outline-none"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-400 mb-1">Target Age</label>
                                    <select
                                        value={targetAge}
                                        onChange={e => setTargetAge(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm focus:border-purple-500 outline-none"
                                    >
                                        <option value="4-6 years">4-6 years</option>
                                        <option value="6-8 years">6-8 years</option>
                                        <option value="8-12 years">8-12 years</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-400 mb-1">Total Pages</label>
                                    <input
                                        type="number"
                                        required min="4" max="25"
                                        value={totalPages}
                                        onChange={e => setTotalPages(parseInt(e.target.value))}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm focus:border-purple-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-300 hover:bg-slate-800">
                                    Cancel
                                </button>
                                <button type="submit" disabled={creating} className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-xl text-sm font-black transition-all">
                                    {creating ? 'Creating...' : 'Create Book'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
