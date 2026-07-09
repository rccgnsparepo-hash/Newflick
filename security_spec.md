# Security Specification (TDD Rules Validation)

This document defines the security parameters, data invariants, and adversarial "Dirty Dozen" test cases to secure the Firestore database for our Social Media Real-time Chat implementation.

## 1. Data Invariants

1. **User Profiling (`/users/{userId}`)**:
   - Only the authenticated user matching `userId` can create or update their profile.
   - Profile `publicKey` is immutable once set or must be strictly matched to valid characters.
   - Status transitions must be string limited to `['online', 'offline']`.
   - Creation requires `uid` matching the document path and `request.auth.uid`.

2. **Private Info (`/users/{userId}/private/info`)**:
   - Strictly isolated using Split Collection. ONLY the owner `userId` can read or write.
   
3. **Feed Posts (`/posts/{postId}`)**:
   - Anyone authenticated can read/list posts.
   - Only the author (matching `authorId`) can create, update, or delete their posts.
   - For update operations, non-owners cannot touch the post body/content.
   - Non-authors can only trigger liking actions of posts (which uses an atomicity transaction or subcollection). Here we'll allow anyone to like a post or keep likes in a subcollection. Let's make post updates strictly check that unless updating the `likesCount` field alone, the author is the editor.
   - `createdAt` is immutable.
   
4. **Direct Chats (`/chats/{chatId}`)**:
   - Access (read/write) is restricted strictly to users whose UID is listed in `participantIds`.
   - `participantIds` list size must be exactly 2 to prevent unauthorized group leaks.
   - Cannot create a chat under someone else's name.

5. **Direct Messages (`/chats/{chatId}/messages/{messageId}`)**:
   - Access is permitted only if the client is one of the parents' `/chats/{chatId}` registered `participantIds`.
   - Messages cannot be updated or deleted once written (immutable chat history).
   - `senderId` in the message must match `request.auth.uid`.

6. **In-App Notifications (`/notifications/{notificationId}`)**:
   - Only the `receiverId` matching the recipient user can read notifications.
   - Any authenticated user can create a notification (e.g. when typing, message sent, or liking), but they cannot update or delete it once sent.
   - Only the owner (`receiverId == request.auth.uid`) can update the `read` status field, and nothing else.

---

## 2. The "Dirty Dozen" Rogue Payloads & Scenarios

These 12 scenarios try to compromise the integrity, privacy, or billing (denial of wallet) of the database:

1. **Self-Elevating User profile (Identity Spoofing)**:
   A malicious user attempts to create a `/users/attackerUID` profile but sets the `uid` in the body to `victimUID` or changes the email to an admin's email.
   
2. **Ghost-Field Injection on Profile (Resource Poisoning)**:
   User tries to add unrequested fields like `isAdmin: true` or `role: "admin"` to their profile document.
   
3. **Profile Poisoning with Giant Payloads (Denial of Wallet)**:
   An attacker updates their status with a 1MB string of junk data instead of `"online"` or `"offline"`.
   
4. **Foreign Account Snooping (PII Leak)**:
   User `A` tries to perform a GET on `/users/B/private/info` to dump confidential data.
   
5. **Feed Hijacking (Update Impersonation)**:
   User `B` sends a patch to `/posts/postId` (owned by User `A`) to change the body content and write malicious tracking links.
   
6. **Double-Click Likes Inflation (State Shortcutting)**:
   An anonymous or unauthenticated browser tries to write posts or likes without a valid session.
   
7. **Post Creation Spoofing (Identity Spoofing)**:
   Attacker writes a post document under `/posts/someId` with `authorId` set to a prominent victim to spread disinformation.
   
8. **Eavesdropping on Foreign Chats (Privacy Breach)**:
   User `C` tries to list messages in `/chats/A_B_chat/messages` where they are not a participant.
   
9. **Rogue Chat Member Injection (Abuse)**:
   An attacker attempts to create a `/chats` document where `participantIds` has 5 entries or doesn't include the attacker, hijacking standard billing and message deliveries.
   
10. **Impersonated Sender Message Write (Relational Integrity)**:
    User `A` posts a message in their chat with `senderId: "victimUID"` to frame other users.
    
11. **Chat Tampering (History Erasing)**:
    A user attempts to delete a message they previously sent in `/chats/{id}/messages/{msgId}` to destroy evidence of misconduct.
    
12. **Foreign Notification Manipulation (Identity Abuse)**:
    User `A` attempts to update User `B`'s `/notifications/{id}` document to toggle its `senderName` or delete the alert.

---

## 3. Test Runner Specification

We will define standard, secure, and robust security rules checking that all dirty or unauthenticated writes fail gracefully with `PERMISSION_DENIED`.
Rules are drafted in `firestore.rules` and tested via live error-catching proxies on the client.
