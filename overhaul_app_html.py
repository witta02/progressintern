import os

# Define path to app.html
filepath = os.path.join("src", "app", "app.html")

print(f"Reading {filepath}...")
with open(filepath, "r", encoding="utf-8") as f:
    html = f.read()

# List of search and replace pairs
replacements = [
    # 1. Loading Screen
    ('<div *ngIf="!initialized" class="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans relative overflow-hidden">',
     '<div *ngIf="!initialized" class="min-h-screen bg-slate-950 flex flex-col items-center justify-center font-sans relative overflow-hidden">'),
    ('bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-35 animate-pulse',
     'bg-indigo-500/10 rounded-full filter blur-3xl opacity-35 animate-pulse'),
    ('bg-emerald-100 rounded-full mix-blend-multiply filter blur-3xl opacity-35 animate-pulse delay-700',
     'bg-teal-500/10 rounded-full filter blur-3xl opacity-35 animate-pulse delay-700'),
    ('bg-purple-100 rounded-full mix-blend-multiply filter blur-3xl opacity-35 animate-pulse delay-1000',
     'bg-purple-500/10 rounded-full filter blur-3xl opacity-35 animate-pulse delay-1000'),
    ('text-slate-400 uppercase tracking-[0.3em] animate-pulse">Loading System...</span>',
     'text-slate-500 uppercase tracking-[0.3em] animate-pulse">Loading System...</span>'),

    # 2. Auth Page Container & Backgrounds
    ('<main *ngIf="initialized && !isAuthenticated" class="min-h-screen grid place-items-center p-6 bg-slate-50 relative overflow-hidden font-sans">',
     '<main *ngIf="initialized && !isAuthenticated" class="min-h-screen grid place-items-center p-6 bg-slate-950 relative overflow-hidden font-sans">'),
    ('bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse',
     'bg-indigo-500/10 rounded-full filter blur-3xl opacity-30 animate-pulse'),
    ('bg-emerald-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse delay-700',
     'bg-teal-500/10 rounded-full filter blur-3xl opacity-30 animate-pulse delay-700'),
    ('bg-purple-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse delay-1000',
     'bg-purple-500/10 rounded-full filter blur-3xl opacity-30 animate-pulse delay-1000'),
    ('<section class="w-full max-w-md bg-white rounded-[2rem] shadow-2xl shadow-blue-500/10 border border-slate-200 p-10 z-10">',
     '<section class="w-full max-w-md glass-card rounded-[2rem] p-10 z-10 relative overflow-hidden"><div class="absolute -top-40 -left-40 w-80 h-80 bg-brand-accent/5 rounded-full blur-3xl"></div>'),
    ('text-slate-900 tracking-tight leading-none">Intern Manager</h1>',
     'text-white tracking-tight leading-none">Intern Manager</h1>'),
    ('text-slate-400 uppercase tracking-[0.3em] mt-2">{{ useMockData ? \'Mock data mode\' : \'Live Production\' }}</p>',
     'text-brand-accent-teal uppercase tracking-[0.3em] mt-2">{{ useMockData ? \'Mock data mode\' : \'Live Production\' }}</p>'),
    ('<div class="flex p-1.5 bg-slate-100 rounded-2xl mb-10" role="tablist">',
     '<div class="flex p-1.5 bg-white/5 border border-white/5 rounded-2xl mb-10" role="tablist">'),
    ('[class.bg-white]="authMode === \'login\'"\n        [class.text-blue-600]="authMode === \'login\'"\n        [class.shadow-md]="authMode === \'login\'"\n        [class.text-slate-500]="authMode !== \'login\'"',
     '[class.bg-white/10]="authMode === \'login\'"\n        [class.text-brand-accent-teal]="authMode === \'login\'"\n        [class.text-white]="authMode === \'login\'"\n        [class.text-slate-400]="authMode !== \'login\'"'),
    ('[class.bg-white]="authMode === \'register\'"\n        [class.text-blue-600]="authMode === \'register\'"\n        [class.shadow-md]="authMode === \'register\'"\n        [class.text-slate-500]="authMode !== \'register\'"',
     '[class.bg-white/10]="authMode === \'register\'"\n        [class.text-brand-accent-teal]="authMode === \'register\'"\n        [class.text-white]="authMode === \'register\'"\n        [class.text-slate-400]="authMode !== \'register\'"'),

    # 3. Form fields in Auth Forms
    ('class="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none text-slate-900 font-bold placeholder:text-slate-300',
     'class="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl focus:bg-white/10 focus:ring-4 focus:ring-brand-accent/20 focus:border-brand-accent transition-all outline-none text-white font-bold placeholder:text-slate-500'),
    ('class="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none text-slate-900 font-bold placeholder:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"',
     'class="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl focus:bg-white/10 focus:ring-4 focus:ring-brand-accent/20 focus:border-brand-accent transition-all outline-none text-white font-bold placeholder:text-slate-500 disabled:opacity-50 disabled:cursor-not-allowed"'),
    ('class="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Email Address</label>',
     'class="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>'),
    ('class="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Password</label>',
     'class="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>'),
    ('class="text-xs font-black text-rose-500 bg-rose-50 p-3 rounded-xl border border-rose-100"',
     'class="text-xs font-black text-rose-400 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20"'),
    ('class="w-full py-5 bg-slate-900 hover:bg-blue-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-slate-200 transition-all transform hover:-translate-y-1 active:translate-y-0 active:scale-95 flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"',
     'class="w-full py-5 bg-brand-accent hover:bg-brand-accent/90 text-white rounded-2xl font-black text-lg shadow-glow-indigo transition-all transform hover:-translate-y-0.5 active:translate-y-0 active:scale-95 flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"'),
    ('class="text-center text-xs font-bold text-slate-400 pt-4 uppercase tracking-widest">\n        ยังไม่มีบัญชี?\n        <button type="button" class="text-blue-600 hover:underline ml-1"',
     'class="text-center text-xs font-bold text-slate-400 pt-4 uppercase tracking-widest">\n        ยังไม่มีบัญชี?\n        <button type="button" class="text-brand-accent-teal font-black hover:underline ml-1"'),
    ('class="text-center text-xs font-bold text-slate-400 pt-4 pb-6 uppercase tracking-widest">\n        มีบัญชีอยู่แล้ว?\n        <button type="button" class="text-blue-600 hover:underline ml-1"',
     'class="text-center text-xs font-bold text-slate-400 pt-4 pb-6 uppercase tracking-widest">\n        มีบัญชีอยู่แล้ว?\n        <button type="button" class="text-brand-accent-teal font-black hover:underline ml-1"'),
    ('class="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">รหัสลงทะเบียน / รหัสเชิญ</label>',
     'class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">รหัสลงทะเบียน / รหัสเชิญ</label>'),
    ('class="text-xs font-black text-emerald-600 bg-emerald-50 px-4 py-3 rounded-xl border border-emerald-100 flex items-center gap-2"',
     'class="text-xs font-black text-emerald-400 bg-emerald-500/10 px-4 py-3 rounded-xl border border-emerald-500/20 flex items-center gap-2"'),
    ('class="text-xs font-black text-rose-500 bg-rose-50 px-4 py-3 rounded-xl border border-rose-100"',
     'class="text-xs font-black text-rose-400 bg-rose-500/10 px-4 py-3 rounded-xl border border-rose-500/20"'),
    ('class="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">ชื่อ-นามสกุล</label>',
     'class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ชื่อ-นามสกุล</label>'),
    ('class="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Email</label>',
     'class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>'),
    ('class="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">เบอร์โทรศัพท์</label>',
     'class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">เบอร์โทรศัพท์</label>'),
    ('class="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">รหัสผ่าน</label>',
     'class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">รหัสผ่าน</label>'),
    ('class="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">ยืนยันรหัสผ่าน</label>',
     'class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ยืนยันรหัสผ่าน</label>'),
    ('class="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">ชื่อบริษัท</label>',
     'class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ชื่อบริษัท</label>'),
    ('class="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">อีเมลติดต่อ (HR)</label>',
     'class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">อีเมลติดต่อ (HR)</label>'),
    ('class="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">คำอธิบายบริษัท</label>',
     'class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">คำอธิบายบริษัท</label>'),
    ('class="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">ที่อยู่บริษัท</label>',
     'class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ที่อยู่บริษัท</label>'),
    ('class="w-full py-5 bg-slate-900 hover:bg-blue-600 disabled:opacity-50 text-white rounded-2xl font-black text-lg shadow-xl shadow-slate-200 transition-all transform hover:-translate-y-1 active:translate-y-0 active:scale-95 mt-6"',
     'class="w-full py-5 bg-brand-accent hover:bg-brand-accent/90 disabled:opacity-50 text-white rounded-2xl font-black text-lg shadow-glow-indigo transition-all transform hover:-translate-y-0.5 active:translate-y-0 active:scale-95 mt-6"'),

    # 4. Top Navbar Layout
    ('<nav class="sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b border-slate-200/60 px-4 sm:px-8 h-16 sm:h-20 flex items-center justify-between shadow-sm">',
     '<nav class="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-white/5 px-4 sm:px-8 h-16 sm:h-20 flex items-center justify-between shadow-lg">'),
    ('<div class="w-9 h-9 sm:w-11 sm:h-11 bg-slate-900 rounded-xl sm:rounded-2xl flex items-center justify-center text-white font-black text-base sm:text-lg transition-all group-hover:bg-blue-600 group-hover:rotate-3 shadow-lg shadow-slate-200">IM</div>',
     '<div class="w-9 h-9 sm:w-11 sm:h-11 bg-brand-accent rounded-xl sm:rounded-2xl flex items-center justify-center text-white font-black text-base sm:text-lg transition-all group-hover:bg-brand-accent-teal group-hover:rotate-3 shadow-glow-indigo">IM</div>'),
    ('<span class="text-base sm:text-xl font-black text-slate-900 tracking-tighter hidden sm:block">InternManager</span>',
     '<span class="text-base sm:text-xl font-black text-white tracking-tighter hidden sm:block">InternManager</span>'),
    ('[class.text-blue-600]="activeView === view"\n          [class.text-slate-400]="activeView !== view"',
     '[class.text-brand-accent-teal]="activeView === view"\n          [class.text-slate-500]="activeView !== view"'),
    ('group-hover:text-blue-600">{{ viewLabels[view] }}</span>',
     'group-hover:text-brand-accent-teal">{{ viewLabels[view] }}</span>'),
    ('<div class="absolute bottom-0 left-4 right-4 h-1 bg-blue-600 rounded-t-full transition-all" [class.opacity-100]="activeView === view" [class.opacity-0]="activeView !== view"></div>',
     '<div class="absolute bottom-0 left-4 right-4 h-1 bg-brand-accent-teal shadow-glow-teal rounded-t-full transition-all" [class.opacity-100]="activeView === view" [class.opacity-0]="activeView !== view"></div>'),
    ('class="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-0.5">{{ roleLabel }}</span>',
     'class="text-[10px] font-black text-brand-accent-teal uppercase tracking-widest mb-0.5">{{ roleLabel }}</span>'),
    ('class="text-sm font-black text-slate-900">{{ currentUser?.name }}</span>',
     'class="text-sm font-black text-white">{{ currentUser?.name }}</span>'),
    ('class="w-px h-8 bg-slate-200 hidden sm:block"></div>',
     'class="w-px h-8 bg-white/10 hidden sm:block"></div>'),
    ('class="relative w-10 h-10 sm:w-12 sm:h-11 flex items-center justify-center bg-slate-100 hover:bg-blue-50 hover:text-blue-600 rounded-xl sm:rounded-2xl text-slate-500 transition-all border border-transparent hover:border-blue-100"',
     'class="relative w-10 h-10 sm:w-12 sm:h-11 flex items-center justify-center bg-white/5 hover:bg-white/10 hover:text-brand-accent-teal rounded-xl sm:rounded-2xl text-slate-400 transition-all border border-white/10"'),
    ('border-2 sm:border-4 border-white" *ngIf="notifications.unreadCount() > 0">',
     'border-2 sm:border-4 border-slate-950" *ngIf="notifications.unreadCount() > 0">'),
    ('<button type="button" class="px-3 sm:px-5 py-2 sm:py-3 bg-white border border-rose-100 text-rose-600 font-black text-[10px] sm:text-xs uppercase tracking-widest rounded-xl sm:rounded-2xl hover:bg-rose-50 transition-all shadow-sm shadow-rose-100 hidden sm:block" (click)="logout()">',
     '<button type="button" class="px-3 sm:px-5 py-2 sm:py-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 font-black text-[10px] sm:text-xs uppercase tracking-widest rounded-xl sm:rounded-2xl hover:bg-rose-500/20 hover:text-rose-300 transition-all hidden sm:block" (click)="logout()">'),
    ('<button type="button" class="lg:hidden p-2.5 bg-slate-100 rounded-xl text-slate-900" (click)="toggleSidebar()">',
     '<button type="button" class="lg:hidden p-2.5 bg-white/5 border border-white/10 rounded-xl text-white" (click)="toggleSidebar()">'),

    # 5. Global Page Header inside Main Container
    ('<main *ngIf="initialized && isAuthenticated" class="min-h-screen bg-slate-50 flex flex-col font-sans">',
     '<main *ngIf="initialized && isAuthenticated" class="min-h-screen bg-slate-950 flex flex-col font-sans">'),
    ('<span class="w-8 h-0.5 bg-blue-600"></span>',
     '<span class="w-8 h-0.5 bg-brand-accent"></span>'),
    ('<span class="text-[10px] font-black text-blue-600 uppercase tracking-[0.4em]">{{ roleLabel }}</span>',
     '<span class="text-[10px] font-black text-brand-accent-teal uppercase tracking-[0.4em]">{{ roleLabel }}</span>'),
    ('<h2 class="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-none">{{ activeView === \'dashboard\' ? \'Dashboard\' : viewLabels[activeView] }}</h2>',
     '<h2 class="text-3xl sm:text-5xl font-black text-white tracking-tight leading-none">{{ activeView === \'dashboard\' ? \'Dashboard\' : viewLabels[activeView] }}</h2>'),

    # 6. Dashboard Metrics Grid
    ('class="bg-white p-10 rounded-[2rem] border border-slate-200/60 shadow-xl shadow-slate-200/20 relative overflow-hidden group hover:scale-[1.03] transition-all duration-500 cursor-pointer animate-in fade-in"',
     'class="glass-card p-10 rounded-[2rem] relative overflow-hidden group hover:scale-[1.03] transition-all duration-300 cursor-pointer animate-fade-in"'),
    ('bg-gradient-to-r" [ngClass]="[\'from-blue-500 to-blue-600\', \'from-purple-500 to-purple-600\', \'from-emerald-500 to-emerald-600\', \'from-amber-500 to-amber-600\'][i % 4]"',
     'bg-gradient-to-r" [ngClass]="[\'from-indigo-500 to-teal-400\', \'from-indigo-500 to-purple-600\', \'from-teal-400 to-emerald-600\', \'from-amber-500 to-rose-600\'][i % 4]"'),
    ('strong class="text-6xl font-black text-slate-900 leading-none tracking-tighter group-hover:text-blue-600 transition-colors"',
     'strong class="text-6xl font-black text-white leading-none tracking-tighter group-hover:text-brand-accent-teal transition-colors"'),
    ('class="mt-4 flex items-center gap-1 text-[10px] font-black text-blue-600 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity"',
     'class="mt-4 flex items-center gap-1 text-[10px] font-black text-brand-accent-teal uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity"'),

    # 7. Student Pending Banner
    ('<div *ngIf="currentUser?.role === \'student\' && currentUser?.status === \'pending\'" class="bg-amber-50 border border-amber-200 rounded-[2rem] p-10 flex items-start gap-8 shadow-lg shadow-amber-500/5">',
     '<div *ngIf="currentUser?.role === \'student\' && currentUser?.status === \'pending\'" class="bg-amber-950/20 border border-amber-900/30 rounded-[2rem] p-10 flex items-start gap-8 shadow-glass">'),
    ('<div class="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-amber-500 shrink-0 shadow-xl shadow-amber-200 border border-amber-100">',
     '<div class="w-20 h-20 bg-slate-900 border border-white/10 rounded-3xl flex items-center justify-center text-amber-500 shrink-0 shadow-lg">'),
    ('<h3 class="text-2xl font-black text-amber-900 mb-2">Pending Account Approval</h3>',
     '<h3 class="text-2xl font-black text-amber-200 mb-2">Pending Account Approval</h3>'),
    ('<p class="text-lg text-amber-800 font-medium max-w-2xl leading-relaxed">\n              Your account is currently being reviewed by your advisor at \n              <span class="font-black text-amber-950 underline decoration-amber-500/50 underline-offset-4">{{ currentUser?.school }}</span>.',
     '<p class="text-lg text-slate-300 font-medium max-w-2xl leading-relaxed">\n              Your account is currently being reviewed by your advisor at \n              <span class="font-black text-white underline decoration-amber-500/50 underline-offset-4">{{ currentUser?.school }}</span>.'),

    # 8. Student Dashboard Attendance widget
    ('<div class="bg-gradient-to-br from-blue-600 to-indigo-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden h-full flex flex-col justify-between min-h-[350px]">',
     '<div class="bg-gradient-to-br from-indigo-900/60 to-slate-900 border border-white/10 rounded-[2.5rem] p-10 text-white shadow-glass relative overflow-hidden h-full flex flex-col justify-between min-h-[350px]">'),
    ('<span class="inline-flex px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-white/10 text-blue-200 border border-white/10 shadow-sm mb-6">',
     '<span class="inline-flex px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-white/5 text-slate-300 border border-white/10 shadow-sm mb-6">'),
    ('button type="button" (click)="checkIn()" class="w-full py-5 bg-white text-blue-600 hover:bg-slate-50 rounded-2xl font-black text-lg shadow-xl hover:scale-[1.02] active:scale-95 transition-all cursor-pointer">',
     'button type="button" (click)="checkIn()" class="w-full py-5 bg-brand-accent hover:bg-brand-accent/90 text-white rounded-2xl font-black text-lg shadow-glow-indigo hover:scale-[1.02] active:scale-95 transition-all cursor-pointer">'),
    ('<div class="bg-white/10 border border-white/10 rounded-2xl p-5 mb-2 flex justify-between items-center">',
     '<div class="bg-white/5 border border-white/10 rounded-2xl p-5 mb-2 flex justify-between items-center">'),
    ('button type="button" (click)="checkOut()" class="w-full py-5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black text-lg shadow-xl hover:scale-[1.02] active:scale-95 transition-all cursor-pointer">',
     'button type="button" (click)="checkOut()" class="w-full py-5 bg-white/10 border border-white/10 hover:bg-white/20 text-white rounded-2xl font-black text-lg shadow-xl hover:scale-[1.02] active:scale-95 transition-all cursor-pointer">'),
    ('class="bg-emerald-500/20 border border-emerald-500/20 rounded-2xl p-6 flex items-center gap-4 text-emerald-200"',
     'class="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 flex items-center gap-4 text-emerald-400"'),
    ('<div class="w-12 h-12 rounded-xl bg-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">',
     '<div class="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">'),

    # 9. Student Dashboard Logbook entry widget
    ('<div class="bg-white rounded-[2.5rem] p-10 border border-slate-200/60 shadow-2xl shadow-slate-200/20 h-full flex flex-col justify-between">',
     '<div class="glass-card p-10 rounded-[2.5rem] h-full flex flex-col justify-between">'),
    ('<span class="inline-flex px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 border border-blue-100 shadow-sm mb-6">',
     '<span class="inline-flex px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-brand-accent/15 text-brand-accent border border-brand-accent/20 shadow-sm mb-6">'),
    ('h4 class="text-3xl font-black text-slate-900 mb-2 tracking-tight">ส่งรายงานประจำวัน</h4>',
     'h4 class="text-3xl font-black text-white mb-2 tracking-tight">ส่งรายงานประจำวัน</h4>'),
    ('class="text-slate-500 font-medium text-sm mb-6 leading-relaxed">เขียนสรุปผลและส่งรายงานความคืบหน้าให้ผู้ประเมินของคุณ</p>',
     'class="text-slate-400 font-medium text-sm mb-6 leading-relaxed">เขียนสรุปผลและส่งรายงานความคืบหน้าให้ผู้ประเมินของคุณ</p>'),
    ('class="p-8 text-center text-slate-400 font-bold text-sm bg-slate-50 rounded-2xl border border-dashed"',
     'class="p-8 text-center text-slate-500 font-bold text-sm bg-white/5 border border-dashed border-white/10 rounded-2xl"'),
    ('class="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">หัวข้อรายงาน</label>',
     'class="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">หัวข้อรายงาน</label>'),
    ('class="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">รายละเอียดงานที่ทำ</label>',
     'class="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">รายละเอียดงานที่ทำ</label>'),
    ('class="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none font-bold text-slate-900 placeholder:text-slate-400 transition-all"',
     'class="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl focus:bg-white/10 focus:ring-4 focus:ring-brand-accent/20 focus:border-brand-accent outline-none font-bold text-white placeholder:text-slate-500 transition-all"'),
    ('class="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none font-bold text-slate-900 placeholder:text-slate-400 transition-all resize-none"',
     'class="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl focus:bg-white/10 focus:ring-4 focus:ring-brand-accent/20 focus:border-brand-accent outline-none font-bold text-white placeholder:text-slate-500 transition-all resize-none"'),
    ('class="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm transition-all shadow-lg shadow-blue-200 cursor-pointer hover:scale-[1.01]"',
     'class="w-full py-4 bg-brand-accent hover:bg-brand-accent/90 text-white rounded-2xl font-black text-sm transition-all shadow-glow-indigo cursor-pointer hover:scale-[1.01]"')
]

# Apply all search and replaces
for target, replacement in replacements:
    if target in html:
        html = html.replace(target, replacement)
    else:
        print(f"WARNING: Target snippet not found! {target[:50]}...")

# Write back
with open(filepath, "w", encoding="utf-8") as f:
    f.write(html)
print("Finished basic replacements in app.html!")
