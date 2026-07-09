awk '
/export const SCOPES = \[/ {
  print "export const SCOPES = ["
  print "  // Existing Drive"
  print "  '\''https://www.googleapis.com/auth/drive'\'',"
  print "  '\''https://www.googleapis.com/auth/drive.file'\'',"
  print "  '\''https://www.googleapis.com/auth/drive.readonly'\'',"
  print "  '\''https://www.googleapis.com/auth/drive.metadata.readonly'\'',"
  print "  // Existing Tasks"
  print "  '\''https://www.googleapis.com/auth/tasks'\'',"
  print "  '\''https://www.googleapis.com/auth/tasks.readonly'\'',"
  print "  // Existing Chat"
  print "  '\''https://www.googleapis.com/auth/chat.messages'\'',"
  print "  '\''https://www.googleapis.com/auth/chat.messages.create'\'',"
  print "  '\''https://www.googleapis.com/auth/chat.messages.readonly'\'',"
  print "  '\''https://www.googleapis.com/auth/chat.spaces'\'',"
  print "  '\''https://www.googleapis.com/auth/chat.spaces.readonly'\'',"
  print "  '\''https://www.googleapis.com/auth/chat.memberships'\'',"
  print "  '\''https://www.googleapis.com/auth/chat.memberships.readonly'\'',"
  print "  // New Gmail"
  print "  '\''https://mail.google.com/'\'',"
  print "  '\''https://www.googleapis.com/auth/gmail.modify'\'',"
  print "  '\''https://www.googleapis.com/auth/gmail.readonly'\'',"
  print "  '\''https://www.googleapis.com/auth/gmail.send'\'',"
  print "  // New Calendar"
  print "  '\''https://www.googleapis.com/auth/calendar'\'',"
  print "  '\''https://www.googleapis.com/auth/calendar.events'\'',"
  print "  // New Contacts"
  print "  '\''https://www.googleapis.com/auth/contacts'\'',"
  print "  '\''https://www.googleapis.com/auth/contacts.other.readonly'\'',"
  print "  '\''https://www.googleapis.com/auth/contacts.readonly'\'',"
  print "  '\''https://www.googleapis.com/auth/directory.readonly'\'',"
  print "  '\''https://www.googleapis.com/auth/user.addresses.read'\'',"
  print "  '\''https://www.googleapis.com/auth/user.birthday.read'\'',"
  print "  '\''https://www.googleapis.com/auth/user.emails.read'\'',"
  print "  '\''https://www.googleapis.com/auth/user.gender.read'\'',"
  print "  '\''https://www.googleapis.com/auth/user.organization.read'\'',"
  print "  '\''https://www.googleapis.com/auth/user.phonenumbers.read'\''"
  print "];"
  in_scopes = 1
  next
}
in_scopes == 1 {
  if (/\];/) {
    in_scopes = 0
  }
  next
}
{ print }
' src/lib/workspaceAuth.ts > src/lib/workspaceAuth.tmp && mv src/lib/workspaceAuth.tmp src/lib/workspaceAuth.ts
