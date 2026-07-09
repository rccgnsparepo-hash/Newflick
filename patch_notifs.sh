awk '
/where\('\''receiverId'\'', '\''=='\'', userId\),/ {
  print "    where('\''receiverId'\'', '\''=='\'', userId),"
  print "    // Client-side filtering workaround to bypass composite index requirement"
  print "    // where('\''read'\'', '\''=='\'', false),"
  print "    // orderBy('\''createdAt'\'', '\''desc'\''),"
  print "    // limit(20)"
  next
}
/where\('\''read'\'', '\''=='\'', false\),/ { next }
/orderBy\('\''createdAt'\'', '\''desc'\''\),/ { next }
/limit\(20\)/ { next }
/callback\(snap.docs.map\(d => d.data\(\) as InAppNotification\)\);/ {
  print "    let notifs = snap.docs.map(d => d.data() as InAppNotification);"
  print "    notifs = notifs.filter(n => n.read === false);"
  print "    notifs.sort((a, b) => {"
  print "      const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;"
  print "      const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;"
  print "      return bTime - aTime;"
  print "    });"
  print "    callback(notifs.slice(0, 20));"
  next
}
{ print }
' src/lib/services.ts > src/lib/services.tmp && mv src/lib/services.tmp src/lib/services.ts
