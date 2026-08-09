import { Router } from 'express';
import { ApiControllers } from './controllers';

export function createApiRouter(controllers: ApiControllers): Router {
  const router = Router();

  // Public Health
  router.get('/health', controllers.getHealth);

  // Auth & Users
  router.post('/api/auth/register-login', controllers.registerOrLogin);
  router.get('/api/users', controllers.getUsers);

  // Messages & Conversations
  router.get('/api/conversations', controllers.getConversations);
  router.post('/api/messages', controllers.sendMessage);
  router.get('/api/messages/:conversationId', controllers.getMessages);

  // Stories & Feed
  router.post('/api/stories', controllers.createStory);
  router.get('/api/stories', controllers.getStories);
  router.post('/api/posts', controllers.createPost);
  router.get('/api/feed', controllers.getFeed);

  // Media
  router.post('/api/media/upload', controllers.uploadMedia);

  // Admin Dashboard
  router.get('/api/admin/status', controllers.getAdminStatus);

  return router;
}
