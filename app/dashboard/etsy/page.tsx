export default function EtsyDashboard() {
    return (
        <div className="flex flex-col gap-8">
            <header className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold">🖍️ Etsy Coloring Books</h2>
                    <p className="text-slate-400 mt-1">Manage, generate, and export your children's storybooks.</p>
                </div>
                <div className="flex gap-3">
                    <button className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 rounded-xl text-sm font-black flex items-center gap-2 transition-all shadow-lg shadow-purple-500/20">
                        <span>+</span> Create New Book
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Metric Cards */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <h3 className="text-slate-400 text-sm font-bold tracking-wider">TOTAL BOOKS</h3>
                    <p className="text-4xl font-black mt-2">0</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <h3 className="text-slate-400 text-sm font-bold tracking-wider">TOTAL SALES</h3>
                    <p className="text-4xl font-black text-emerald-400 mt-2">0 <span className="text-sm font-medium text-slate-500">copies</span></p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <h3 className="text-slate-400 text-sm font-bold tracking-wider">EST. REVENUE</h3>
                    <p className="text-4xl font-black text-amber-400 mt-2">$0.00</p>
                </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 flex flex-col items-center justify-center text-center">
                <span className="text-6xl mb-6 opacity-80">📖</span>
                <h3 className="text-2xl font-bold text-slate-200">No Books Found</h3>
                <p className="text-slate-400 mt-2 max-w-md">
                    Start a new project by clicking "Create New Book" above.
                    AI will automatically generate stories and layout templates for you.
                </p>
            </div>
        </div>
    )
}
