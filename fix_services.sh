awk '
/const q = query\(collection\(db, '\''posts'\''\), orderBy\('\''createdAt'\'', '\''desc'\''\), limit\(100\)\);/ {
  if (inFeed == 1) {
    # Only keep the one in subscribeToFeed
    # Wait, lets just manually remove them all and re-add carefully.
  }
}
'
