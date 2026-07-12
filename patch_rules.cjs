const fs = require('fs');
let code = fs.readFileSync('firestore.rules', 'utf8');

// Update the chats update rule
code = code.replace(
`      allow update: if isSignedIn() && (
        request.auth.uid in resource.data.participantIds
        || chatId == 'global-node-concourse'
      );`,
`      allow update: if isSignedIn() && (
        request.auth.uid in resource.data.participantIds
        || chatId == 'global-node-concourse'
        || (request.resource.data.diff(resource.data).affectedKeys().hasOnly(['participantIds']) && request.auth.uid in request.resource.data.participantIds)
      );`
);

code = code.replace(
`      allow delete: if false;`,
`      allow delete: if isSignedIn() && request.auth.uid in resource.data.participantIds;`
);

fs.writeFileSync('firestore.rules', code);
