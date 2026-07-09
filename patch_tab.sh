awk '
/Section 2: TACTICAL PIPELINES/ {
  print "                {/* Workspace Tab */}"
  print "                <button"
  print "                  onClick={() => { playGlitchClickSound(); triggerVibration('\''light'\''); setActiveTab('\''workspace'\''); }}"
  print "                  className={`relative flex items-center w-full transition-all duration-200 cursor-pointer rounded-xl group ${"
  print "                    activeTab === '\''workspace'\''"
  print "                       ? '\''text-[var(--neon-green)]'\''"
  print "                       : '\''text-zinc-500 hover:text-zinc-300 hover:bg-zinc-950/50'\''"
  print "                  } ${sidebarExpanded ? '\''px-3.5 py-3 gap-3.5'\'' : '\''justify-center h-11 w-11 mx-auto'\''}`}"
  print "                  title=\"Google Workspace\""
  print "                >"
  print "                  {activeTab === '\''workspace'\'' && ("
  print "                    <motion.div "
  print "                      layoutId=\"activeTabGlow\""
  print "                      className=\"absolute inset-0 bg-[var(--neon-green)]/10 border-l-2 border-[var(--neon-green)] rounded-xl pointer-events-none\""
  print "                      transition={{ type: '\''spring'\'', damping: 20, stiffness: 300 }}"
  print "                    />"
  print "                  )}"
  print "                  <Briefcase className=\"w-4.5 h-4.5 shrink-0 z-10\" />"
  print "                  {sidebarExpanded && ("
  print "                    <span className=\"text-[10px] font-mono font-bold tracking-wider z-10 uppercase\">WORKSPACE HUB</span>"
  print "                  )}"
  print "                </button>"
}
{ print }
' src/components/FeedSection.tsx > src/components/FeedSection.tmp && mv src/components/FeedSection.tmp src/components/FeedSection.tsx
