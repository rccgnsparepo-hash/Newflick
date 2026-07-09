awk '
/return onSnapshot\(q, \(snap\) => {/ {
  print "  const q = query(collection(db, '\''posts'\''), orderBy('\''createdAt'\'', '\''desc'\''), limit(100));"
  print
  next
}
{ print }
' src/lib/services.ts > src/lib/services.tmp && mv src/lib/services.tmp src/lib/services.ts
