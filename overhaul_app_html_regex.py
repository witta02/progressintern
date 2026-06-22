import os
import re

filepath = os.path.join("src", "app", "app.html")

print(f"Reading {filepath}...")
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Helper function to do regex replacements inside HTML tags
def replace_in_classes(match):
    tag = match.group(0)
    
    # 1. Overhaul input/textarea styling
    tag = tag.replace("bg-slate-50 border border-slate-200", "bg-white/5 border border-white/10 text-white placeholder:text-slate-500")
    tag = tag.replace("bg-slate-50 border border-slate-200/80", "bg-white/5 border border-white/10 text-white placeholder:text-slate-500")
    tag = tag.replace("bg-slate-50 border border-slate-200/60", "bg-white/5 border border-white/10 text-white placeholder:text-slate-500")
    
    # 2. Overhaul focus state ring colors
    tag = tag.replace("focus:bg-white", "focus:bg-white/10")
    tag = tag.replace("focus:ring-4 focus:ring-blue-500/10", "focus:ring-4 focus:ring-brand-accent/20")
    tag = tag.replace("focus:ring-8 focus:ring-blue-500/10", "focus:ring-4 focus:ring-brand-accent/20")
    tag = tag.replace("focus:ring-8 focus:ring-blue-500/10", "focus:ring-4 focus:ring-brand-accent/20")
    tag = tag.replace("focus:ring-8 focus:ring-blue-500/10", "focus:ring-4 focus:ring-brand-accent/20")
    tag = tag.replace("focus:border-blue-500 focus:ring-8 focus:ring-blue-500/10", "focus:ring-4 focus:ring-brand-accent/20 focus:border-brand-accent")
    tag = tag.replace("focus:border-blue-500", "focus:border-brand-accent")
    
    # 3. Clean text-slate-900 / placeholder-slate-300 inside input tags
    if 'input' in tag.lower() or 'textarea' in tag.lower() or 'select' in tag.lower():
        tag = tag.replace("text-slate-900", "text-white")
        tag = tag.replace("placeholder:text-slate-300", "placeholder:text-slate-500")
        tag = tag.replace("placeholder-slate-400", "placeholder:text-slate-500")

    return tag

# Apply tag-specific replacements first
content = re.sub(r'<input[^>]*>|<textarea[^>]*>.*?</textarea>|<select[^>]*>.*?</select>', replace_in_classes, content, flags=re.DOTALL)

# Now apply broader block replacements
replacements = [
    # Table headers
    ('<tr class="bg-slate-50/20">', '<tr class="bg-slate-950/40 border-b border-white/5">'),
    ('<tr class="bg-slate-50/50">', '<tr class="bg-slate-950/40 border-b border-white/5">'),
    ('<tr class="bg-slate-50/50 border-b border-slate-100">', '<tr class="bg-slate-950/40 border-b border-white/5">'),
    ('<tr class="bg-gradient-to-r from-slate-50 to-blue-50/30">', '<tr class="bg-slate-950/40 border-b border-white/5">'),
    ('<tr class="bg-gradient-to-r from-slate-50 to-blue-50/30">', '<tr class="bg-slate-950/40 border-b border-white/5">'),
    
    # Th styles
    ('text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]', 'text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]'),
    
    # Tbody divide
    ('<tbody class="divide-y divide-slate-100">', '<tbody class="divide-y divide-white/5">'),
    ('<tbody class="divide-y divide-slate-100 bg-white">', '<tbody class="divide-y divide-white/5 bg-transparent">'),
    
    # Tr hover
    ('class="hover:bg-blue-50/10 transition-colors"', 'class="hover:bg-white/[0.02] transition-colors border-b border-white/5"'),
    ('class="hover:bg-blue-50/10 transition-colors"', 'class="hover:bg-white/[0.02] transition-colors border-b border-white/5"'),
    ('class="hover:bg-blue-50/20 transition-colors"', 'class="hover:bg-white/[0.02] transition-colors"'),
    ('class="hover:bg-blue-50/20 transition-colors group"', 'class="hover:bg-white/[0.02] transition-colors group"'),
    ('class="hover:bg-blue-50/30 transition-colors cursor-pointer group"', 'class="hover:bg-white/[0.02] transition-colors cursor-pointer group"'),
    
    # Font-black text-slate-900 / font-bold text-slate-700 in tables
    ('font-black text-slate-900 text-base', 'font-black text-white text-base'),
    ('font-black text-slate-900 text-lg', 'font-black text-white text-lg'),
    ('font-bold text-blue-600 text-sm', 'font-bold text-brand-accent-teal text-sm'),
    ('font-bold text-slate-500', 'font-bold text-slate-400'),
    ('font-bold text-slate-700', 'font-bold text-slate-300'),
    ('font-black text-slate-400 text-xs uppercase tracking-wider', 'font-black text-slate-500 text-xs uppercase tracking-wider'),
    ('font-black text-blue-600 text-xs uppercase tracking-wider', 'font-black text-brand-accent-teal text-xs uppercase tracking-wider'),

    # Card containers
    ('class="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-2xl shadow-slate-200/20 overflow-hidden"',
     'class="glass-card rounded-[2.5rem] overflow-hidden"'),
    ('class="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-2xl shadow-slate-200/30 overflow-hidden"',
     'class="glass-card rounded-[2.5rem] overflow-hidden"'),
    ('class="bg-white rounded-[2rem] sm:rounded-[2.5rem] border border-slate-200/60 shadow-2xl shadow-slate-200/30 overflow-hidden"',
     'class="glass-card rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden"'),
    ('class="bg-white rounded-[2.5rem] p-12 border border-slate-200/60 shadow-2xl shadow-slate-200/20 relative overflow-hidden"',
     'class="glass-card p-12 relative overflow-hidden rounded-[2.5rem]"'),
    
    # Banner/Header backgrounds
    ('p-10 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center',
     'p-10 border-b border-white/5 bg-white/[0.02] flex justify-between items-center'),
    ('p-10 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-6',
     'p-10 border-b border-white/5 bg-white/[0.02] flex flex-col md:flex-row md:items-center justify-between gap-6'),
    
    # Headings
    ('text-3xl font-black text-slate-900 tracking-tight', 'text-3xl font-black text-white tracking-tight'),
    ('text-4xl font-black mb-2 tracking-tight text-slate-900', 'text-4xl font-black mb-2 tracking-tight text-white'),
    ('text-2xl font-black text-slate-900 tracking-tight', 'text-2xl font-black text-white tracking-tight'),
    ('text-3xl font-black text-slate-900 mb-3 group-hover:text-blue-600 transition-colors tracking-tight',
     'text-3xl font-black text-white mb-3 group-hover:text-brand-accent-teal transition-colors tracking-tight'),
    
    # Accent text
    ('text-xs font-black text-blue-600 uppercase tracking-widest mt-2', 'text-xs font-black text-brand-accent-teal uppercase tracking-widest mt-2'),
    ('text-sm font-black text-blue-600 uppercase tracking-widest mt-2', 'text-sm font-black text-brand-accent-teal uppercase tracking-widest mt-2'),
    
    # Progress bars
    ('bg-slate-100 rounded-full h-1.5 overflow-hidden', 'bg-white/10 rounded-full h-1.5 overflow-hidden'),
    ('bg-blue-600 h-full rounded-full', 'bg-gradient-to-r from-indigo-500 to-teal-400 h-full rounded-full'),
    ('text-xs font-black text-slate-700', 'text-xs font-black text-slate-300'),
    ('w-full bg-slate-100 rounded-full h-2 overflow-hidden', 'w-full bg-white/10 rounded-full h-2 overflow-hidden'),
    ('bg-gradient-to-r from-blue-500 to-emerald-500 h-2 rounded-full transition-all', 'bg-gradient-to-r from-indigo-500 to-teal-400 h-2 rounded-full transition-all'),
    
    # Primary Buttons
    ('class="px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-blue-200 transition-all hover:scale-[1.02] cursor-pointer flex items-center gap-2"',
     'class="px-6 py-4 bg-brand-accent hover:bg-brand-accent/90 text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-glow-indigo transition-all hover:scale-[1.02] cursor-pointer flex items-center gap-2"'),
    ('class="w-full py-5 bg-slate-900 hover:bg-blue-600 text-white rounded-2xl font-black text-lg transition-all shadow-xl shadow-slate-200"',
     'class="w-full py-5 bg-brand-accent hover:bg-brand-accent/90 text-white rounded-2xl font-black text-lg shadow-glow-indigo transition-all"'),
    ('class="w-full py-5 bg-slate-900 hover:bg-blue-600 disabled:opacity-50 text-white rounded-2xl font-black text-lg transition-all shadow-xl shadow-slate-200"',
     'class="w-full py-5 bg-brand-accent hover:bg-brand-accent/90 disabled:opacity-50 text-white rounded-2xl font-black text-lg transition-all shadow-glow-indigo"'),
    
    # Secondary Buttons
    ('class="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer"',
     'class="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer border border-white/5"'),
    ('class="px-5 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"',
     'class="px-5 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold text-white outline-none focus:ring-4 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"'),
    ('class="w-full px-5 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all placeholder:text-slate-300"',
     'class="w-full px-5 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold text-white outline-none focus:ring-4 focus:ring-brand-accent/20 focus:border-brand-accent transition-all placeholder:text-slate-500"'),
    ('class="px-5 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all placeholder:text-slate-300"',
     'class="px-5 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold text-white outline-none focus:ring-4 focus:ring-brand-accent/20 focus:border-brand-accent transition-all placeholder:text-slate-500"'),
     
    # Status badges
    ('bg-emerald-50 text-emerald-600 border-emerald-100', 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'),
    ('bg-rose-50 text-rose-600 border-rose-100', 'bg-rose-500/10 text-rose-400 border-rose-500/20'),
    ('bg-amber-50 text-amber-600 border-amber-100', 'bg-amber-500/10 text-amber-400 border-amber-500/20')
]

for target, replacement in replacements:
    content = content.replace(target, replacement)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)

print("Regex-based replacements complete!")
