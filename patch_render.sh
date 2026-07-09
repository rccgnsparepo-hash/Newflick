awk '
/{activeTab === '\''news'\'' && \(/ {
  print "        {/* ==================== WORKSPACE HUB TAB ==================== */}"
  print "        {activeTab === '\''workspace'\'' && ("
  print "          <div className=\"flex-1 overflow-hidden animate-fade-in flex flex-col p-4\">"
  print "            <WorkspaceHub />"
  print "          </div>"
  print "        )}"
}
{ print }
' src/components/FeedSection.tsx > src/components/FeedSection.tmp && mv src/components/FeedSection.tmp src/components/FeedSection.tsx
