awk '
/onClick={() => { playGlitchClickSound(); triggerVibration('\''light'\''); setActiveTab('\''chat'\''); }}/ {
  print "        {/* Workspace Mobile Tab */}"
  print "        <button"
  print "          onClick={() => { playGlitchClickSound(); triggerVibration('\''light'\''); setActiveTab('\''workspace'\''); }}"
  print "          className={`relative flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all duration-300 cursor-pointer z-10 ${"
  print "            activeTab === '\''workspace'\'' ? '\''text-[var(--neon-green)] font-extrabold scale-105'\'' : '\''text-zinc-500'\''"
  print "          }`}"
  print "        >"
  print "          {activeTab === '\''workspace'\'' && ("
  print "            <motion.div "
  print "              layoutId=\"activeTabMobileGlow\""
  print "              className=\"absolute inset-0 bg-[var(--neon-green)]/10 border border-[var(--neon-green)]/20 rounded-xl -z-10\""
  print "              transition={{ type: '\''spring'\'', damping: 18, stiffness: 220 }}"
  print "            />"
  print "          )}"
  print "          <Briefcase className=\"w-4.5 h-4.5\" />"
  print "          <span className=\"text-[7px] mt-0.5 font-mono uppercase tracking-wider\">Hub</span>"
  print "        </button>"
}
{ print }
' src/components/FeedSection.tsx > src/components/FeedSection.tmp && mv src/components/FeedSection.tmp src/components/FeedSection.tsx
