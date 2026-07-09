awk '
/where\('\''participantIds'\'', '\''array-contains'\'', userId\),/ {
  print "    where('\''participantIds'\'', '\''array-contains'\'', userId)"
  print "    // Client-side sorting workaround to bypass composite index requirement"
  print "    // orderBy('\''lastMessageAt'\'', '\''desc'\'')"
  next
}
/orderBy\('\''lastMessageAt'\'', '\''desc'\''\)/ { next }
/const chats = snap.docs.map\(doc => doc.data\(\) as DirectChat\);/ {
  print "    const chats = snap.docs.map(doc => doc.data() as DirectChat);"
  print "    chats.sort((a, b) => {"
  print "      const aTime = a.lastMessageAt?.toMillis ? a.lastMessageAt.toMillis() : 0;"
  print "      const bTime = b.lastMessageAt?.toMillis ? b.lastMessageAt.toMillis() : 0;"
  print "      return bTime - aTime;"
  print "    });"
  next
}
{ print }
' src/lib/services.ts > src/lib/services.tmp && mv src/lib/services.tmp src/lib/services.ts
