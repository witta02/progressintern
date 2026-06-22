import os

filepath = os.path.join("src", "app", "app.html")
print(f"Reading {filepath}...")

with open(filepath, "r", encoding="utf-8") as f:
    html = f.read()

replacements = [
    # 1. Card containers in Admin panels
    ('class="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-xl shadow-slate-200/20 p-10 h-fit space-y-8"',
     'class="glass-card rounded-[2.5rem] p-10 h-fit space-y-8"'),
    ('class="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-xl shadow-slate-200/20 p-10 lg:col-span-2 space-y-8"',
     'class="glass-card rounded-[2.5rem] p-10 lg:col-span-2 space-y-8"'),
    ('class="bg-white rounded-[2rem] border border-slate-200/60 shadow-xl shadow-slate-200/20 p-8 h-fit space-y-6"',
     'class="glass-card rounded-[2rem] p-8 h-fit space-y-6"'),
    ('class="bg-white rounded-[2rem] border border-slate-200/60 shadow-xl shadow-slate-200/20 p-8 lg:col-span-3 space-y-6"',
     'class="glass-card rounded-[2rem] p-8 lg:col-span-3 space-y-6"'),
     
    # 2. Input/select border bg-white elements
    ('class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-brand-accent/20 focus:border-brand-accent transition-all outline-none text-white font-bold"',
     'class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-4 focus:ring-brand-accent/20 focus:border-brand-accent transition-all outline-none text-white font-bold"'),
    ('class="px-5 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"',
     'class="px-5 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold text-white outline-none focus:ring-4 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"'),
    ('class="px-5 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-300 outline-none focus:ring-4 focus:ring-brand-accent/20 focus:border-brand-accent transition-all placeholder:text-slate-500"',
     'class="px-5 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold text-white outline-none focus:ring-4 focus:ring-brand-accent/20 focus:border-brand-accent transition-all placeholder:text-slate-500"'),
    ('class="px-5 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-300 outline-none focus:ring-4 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"',
     'class="px-5 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold text-white outline-none focus:ring-4 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"'),
     
    # 3. Action buttons
    ('class="px-5 py-3 bg-white border border-slate-200 text-slate-700 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-all"',
     'class="px-5 py-3 bg-white/5 border border-white/10 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-white/10 transition-all"'),
    ('class="px-6 py-3.5 bg-slate-900 hover:bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-md flex items-center gap-2"',
     'class="px-6 py-3.5 bg-brand-accent hover:bg-brand-accent/90 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-glow-indigo flex items-center gap-2"'),
     
    # 4. Error/Success boxes
    ('class="bg-rose-50 border border-rose-100 rounded-2xl p-6 flex items-start gap-4"',
     'class="bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl p-6 flex items-start gap-4"'),
    ('class="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 flex items-start gap-4"',
     'class="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl p-6 flex items-start gap-4"'),
    ('font-black text-rose-900 text-sm', 'font-black text-rose-300 text-sm'),
    ('font-black text-emerald-900 text-sm', 'font-black text-emerald-300 text-sm'),
    ('text-xs text-rose-800 font-bold', 'text-xs text-rose-400 font-medium'),
    ('text-xs text-emerald-800 font-bold', 'text-xs text-emerald-400 font-medium'),
    
    # 5. Result grid & schema table borders/text
    ('border-r border-b border-slate-200 text-[10px] font-black text-slate-400 text-center w-12 bg-slate-100',
     'border-r border-b border-white/5 text-[10px] font-black text-slate-400 text-center w-12 bg-white/5'),
    ('class="px-6 py-3 border-r border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap"',
     'class="px-6 py-3 border-r border-b border-white/5 text-[10px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap"'),
    ('class="px-4 py-3 border-r border-slate-200 text-center font-bold text-slate-400 bg-slate-50/50"',
     'class="px-4 py-3 border-r border-white/5 text-center font-bold text-slate-500 bg-white/5"'),
    ('class="px-6 py-3 border-r border-slate-200 text-slate-600 truncate max-w-xs"',
     'class="px-6 py-3 border-r border-white/5 text-slate-300 truncate max-w-xs"'),
    ('class="hover:bg-slate-50/40 transition-colors font-mono text-xs"',
     'class="hover:bg-white/[0.02] transition-colors font-mono text-xs border-b border-white/5"'),
    ('class="px-6 py-4 font-black uppercase text-slate-400 text-xs tracking-wider border-b border-slate-200"',
     'class="px-6 py-4 font-black uppercase text-slate-500 text-xs tracking-wider border-b border-white/5"'),
    ('class="px-6 py-4 text-slate-600 font-bold"',
     'class="px-6 py-4 text-slate-300 font-medium"'),
    ('border-t border-slate-100', 'border-t border-white/5'),
    ('border-b border-slate-100', 'border-b border-white/5'),
    ('border border-slate-200', 'border border-white/10'),
    
    # 6. CSV Export & Delete buttons
    ('class="px-4 py-2 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-600 border border-transparent hover:border-emerald-200 text-slate-600 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all"',
     'class="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 hover:text-emerald-300 text-emerald-400 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all"'),
    ('class="px-4 py-2 bg-white border border-rose-100 hover:bg-rose-50 hover:text-rose-600 text-rose-600 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all"',
     'class="px-4 py-2 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 hover:text-rose-300 text-rose-400 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all"'),
     
    # 7. Workbench tab toggles
    ('class="flex-1 py-4 font-black text-xs uppercase tracking-widest border-b-2 text-center transition-all"',
     'class="flex-1 py-4 font-black text-xs uppercase tracking-widest border-b-2 text-center transition-all"'),
    ("[class.bg-white]=\"workbenchTab === 'query'\"", "[class.bg-white/5]=\"workbenchTab === 'query'\""),
    ("[class.bg-white]=\"workbenchTab === 'schema'\"", "[class.bg-white/5]=\"workbenchTab === 'schema'\""),
    ("[class.text-blue-600]=\"workbenchTab === 'query'\"", "[class.text-brand-accent-teal]=\"workbenchTab === 'query'\""),
    ("[class.text-blue-600]=\"workbenchTab === 'schema'\"", "[class.text-brand-accent-teal]=\"workbenchTab === 'schema'\""),
    ("[class.border-blue-600]=\"workbenchTab === 'query'\"", "[class.border-brand-accent-teal]=\"workbenchTab === 'query'\""),
    ("[class.border-blue-600]=\"workbenchTab === 'schema'\"", "[class.border-brand-accent-teal]=\"workbenchTab === 'schema'\""),
    ("[class.border-transparent]=\"workbenchTab !== 'query'\"", "[class.border-transparent]=\"workbenchTab !== 'query'\""),
    ("[class.border-transparent]=\"workbenchTab !== 'schema'\"", "[class.border-transparent]=\"workbenchTab !== 'schema'\""),
    
    # 8. Clean up textarea input text colors
    ('class="w-full px-6 py-5 bg-white/5 border border-white/10 text-white placeholder:text-slate-500 rounded-2xl focus:bg-white/10 focus:ring-4 focus:ring-brand-accent/20 focus:border-brand-accent font-mono text-sm text-slate-800 transition-all outline-none leading-relaxed"',
     'class="w-full px-6 py-5 bg-white/5 border border-white/10 text-white placeholder:text-slate-500 rounded-2xl focus:bg-white/10 focus:ring-4 focus:ring-brand-accent/20 focus:border-brand-accent font-mono text-sm transition-all outline-none leading-relaxed"'),

    # 9. Dashboard Pending items details
    ('text-lg font-black text-slate-900', 'text-lg font-black text-white'),
    ('bg-white rounded-3xl border border-white/10/60 shadow-lg shadow-slate-200/10 divide-y divide-slate-100 overflow-hidden',
     'glass-card rounded-3xl divide-y divide-white/5 overflow-hidden'),
    ('p-6 hover:bg-slate-50/50 flex justify-between items-center transition-colors',
     'p-6 hover:bg-white/[0.02] flex justify-between items-center transition-colors border-b border-white/5'),
    ('p-6 hover:bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-colors',
     'p-6 hover:bg-white/[0.02] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-colors border-b border-white/5'),
    ('font-black text-slate-900 text-sm truncate', 'font-black text-white text-sm truncate'),
    ('text-xs text-slate-500 truncate', 'text-xs text-slate-400 truncate'),
    ('text-xs text-slate-500 mt-0.5', 'text-xs text-slate-400 mt-0.5'),
    ('font-bold text-slate-800 text-sm mb-0.5', 'font-bold text-slate-200 text-sm mb-0.5'),
    ('text-xs text-slate-500 italic max-w-lg truncate', 'text-xs text-slate-400 italic max-w-lg truncate'),
    ('text-xs text-blue-600 font-bold uppercase tracking-wider truncate mt-0.5', 'text-xs text-brand-accent-teal font-bold uppercase tracking-wider truncate mt-0.5'),
    
    # 10. Dashboard Pending Buttons
    ('class="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[9px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-sm"',
     'class="px-3.5 py-2 bg-brand-accent hover:bg-brand-accent/90 text-white text-[9px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-glow-indigo shadow-sm"'),
    ('class="px-3.5 py-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-500 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer"',
     'class="px-3.5 py-2 bg-white/5 border border-white/10 hover:bg-rose-500/20 hover:text-rose-300 text-slate-400 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer"'),
    ('class="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer"',
     'class="px-3.5 py-2 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 hover:text-rose-300 text-rose-400 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer"'),
    ('class="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-[9px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-sm"',
     'class="px-3.5 py-2 bg-brand-accent-teal hover:bg-brand-accent-teal/90 text-slate-950 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-glow-teal shadow-sm"'),
    
    # 12. Roster and metrics containers
    ('class="bg-white rounded-[2.5rem] border border-white/10/60 shadow-2xl shadow-slate-200/20 overflow-hidden animate-in fade-in"',
     'class="glass-card rounded-[2.5rem] overflow-hidden animate-fade-in"'),
    ('bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full uppercase tracking-wider',
     'bg-brand-accent/15 text-brand-accent border border-brand-accent/20 px-2 py-0.5 rounded-full uppercase tracking-wider')
]

print("Applying replacements...")
for target, replacement in replacements:
    if target in html:
        html = html.replace(target, replacement)
    else:
        print(f"DEBUG: Snippet not found: {target[:60]}...")

with open(filepath, "w", encoding="utf-8") as f:
    f.write(html)

print("Done additional overhaul updates!")
