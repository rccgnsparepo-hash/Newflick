awk '
/import { HardDrive, CheckSquare, MessageSquare, Plus, Trash2, ExternalLink } from '\''lucide-react'\'';/ {
  print "import { HardDrive, CheckSquare, MessageSquare, Plus, Trash2, ExternalLink, Mail, Calendar, Users, FolderOpen } from '\''lucide-react'\'';"
  next
}
/const \[activeTab, setActiveTab\] = useState<'\''drive'\'' | '\''tasks'\'' | '\''chat'\''/ {
  print "  const [activeTab, setActiveTab] = useState<'\''drive'\'' | '\''tasks'\'' | '\''chat'\'' | '\''gmail'\'' | '\''calendar'\'' | '\''contacts'\'' | '\''picker'\''>('\''drive'\'');"
  next
}
/Connect your Google Workspace to access Drive, Tasks, and Chat directly from Node Concourse\./ {
  print "        <p className=\"text-sm mb-6 text-center max-w-sm\">Connect your Google Workspace to access Drive, Tasks, Chat, Gmail, Calendar, Contacts, and Picker.</p>"
  next
}
/<\/div>      <div className=\"flex-1 overflow-hidden relative\">/ {
  print "        <button "
  print "          onClick={() => setActiveTab('\''gmail'\'')}"
  print "          className={`flex-1 p-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 ${activeTab === '\''gmail'\'' ? '\''text-[#ea4335] border-b-2 border-[#ea4335] bg-zinc-900/50'\'' : '\''text-zinc-500 hover:text-zinc-300'\''}`}"
  print "        >"
  print "          <Mail className=\"w-4 h-4\" /> Gmail"
  print "        </button>"
  print "        <button "
  print "          onClick={() => setActiveTab('\''calendar'\'')}"
  print "          className={`flex-1 p-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 ${activeTab === '\''calendar'\'' ? '\''text-[#4285f4] border-b-2 border-[#4285f4] bg-zinc-900/50'\'' : '\''text-zinc-500 hover:text-zinc-300'\''}`}"
  print "        >"
  print "          <Calendar className=\"w-4 h-4\" /> Cal"
  print "        </button>"
  print "        <button "
  print "          onClick={() => setActiveTab('\''contacts'\'')}"
  print "          className={`flex-1 p-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 ${activeTab === '\''contacts'\'' ? '\''text-[#fbbc05] border-b-2 border-[#fbbc05] bg-zinc-900/50'\'' : '\''text-zinc-500 hover:text-zinc-300'\''}`}"
  print "        >"
  print "          <Users className=\"w-4 h-4\" /> Contacts"
  print "        </button>"
  print "        <button "
  print "          onClick={() => setActiveTab('\''picker'\'')}"
  print "          className={`flex-1 p-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 ${activeTab === '\''picker'\'' ? '\''text-white border-b-2 border-white bg-zinc-900/50'\'' : '\''text-zinc-500 hover:text-zinc-300'\''}`}"
  print "        >"
  print "          <FolderOpen className=\"w-4 h-4\" /> Picker"
  print "        </button>"
  print "      </div>"
  print "      <div className=\"flex-1 overflow-hidden relative\">"
  next
}
/{activeTab === '\''chat'\'' && <ChatSection token={token} \/>}/ {
  print "        {activeTab === '\''chat'\'' && <ChatSection token={token} />}"
  print "        {activeTab === '\''gmail'\'' && <GmailSection token={token} />}"
  print "        {activeTab === '\''calendar'\'' && <CalendarSection token={token} />}"
  print "        {activeTab === '\''contacts'\'' && <ContactsSection token={token} />}"
  print "        {activeTab === '\''picker'\'' && <PickerSection token={token} />}"
  next
}
{ print }
' src/components/WorkspaceHub.tsx > src/components/WorkspaceHub.tmp && mv src/components/WorkspaceHub.tmp src/components/WorkspaceHub.tsx
