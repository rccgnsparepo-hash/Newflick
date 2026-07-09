awk '
/\/\/ Real-time pagination listener for optimized scroll feed/ {
  print
  print "export function subscribeToFeed(callback: (posts: Post[]) => void, onError: (err: any) => void) {"
  print "  const path = '\''posts'\'';"
  print "  const q = query(collection(db, '\''posts'\''), orderBy('\''createdAt'\'', '\''desc'\''), limit(100));"
  next
}
/const path = '\''posts'\'';/ {
  if (in_feed == 0) { in_feed = 1; next }
}
{ print }
' src/lib/services.ts > src/lib/services.tmp && mv src/lib/services.tmp src/lib/services.ts
