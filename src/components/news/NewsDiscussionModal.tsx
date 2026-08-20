import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  MessageSquare, 
  Send, 
  Heart, 
  Share2, 
  CheckCircle2, 
  ExternalLink, 
  Flag, 
  Users, 
  Clock, 
  ThumbsUp, 
  CornerDownRight, 
  Repeat2
} from 'lucide-react';
import { NewsArticle, NewsComment } from '../../types/news';
import { newsService } from '../../lib/newsService';
import { playGlitchClickSound, playLikeSound } from '../../lib/sounds';

interface NewsDiscussionModalProps {
  article: NewsArticle | null;
  onClose: () => void;
  currentUser?: any;
  onShareToTimeline?: (article: NewsArticle, comment?: string) => void;
}

export const NewsDiscussionModal: React.FC<NewsDiscussionModalProps> = ({
  article,
  onClose,
  currentUser,
  onShareToTimeline
}) => {
  const [comments, setComments] = useState<NewsComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [repostComment, setRepostComment] = useState('');
  const [showRepostBox, setShowRepostBox] = useState(false);

  useEffect(() => {
    if (!article) return;
    newsService.getComments(article.id).then(setComments);
  }, [article?.id]);

  if (!article) return null;

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    playGlitchClickSound();

    const created = await newsService.postComment(article.id, {
      userId: currentUser?.id || 'citizen-node',
      userName: currentUser?.displayName || currentUser?.name || 'FLICK Citizen',
      userUsername: currentUser?.username || 'citizen',
      userPhoto: currentUser?.photoURL,
      userVerified: currentUser?.verified || false,
      content: newComment.trim(),
      replyToId: replyTo?.id,
      replyToUserName: replyTo?.name
    });

    if (created) {
      setComments(prev => [created, ...prev]);
      setNewComment('');
      setReplyTo(null);
      playLikeSound();
    }
    setIsSubmitting(false);
  };

  const handleRepost = () => {
    if (onShareToTimeline) {
      onShareToTimeline(article, repostComment);
      setShowRepostBox(false);
      setRepostComment('');
      alert('Article reposted to your FLICK social feed!');
    }
  };

  const participantCount = (comments.length * 4) + (article.commentCount || 1) + 12;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto font-mono select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        className="w-full max-w-2xl bg-zinc-950 border-2 border-[var(--neon-green)]/60 shadow-[8px_8px_0_0_#000] flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-950 border border-[var(--neon-green)]/40 text-[var(--neon-green)]">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-black text-white uppercase tracking-wider">
                DISCUSS ON FLICK
              </div>
              <div className="text-[10px] text-emerald-400 font-bold">
                {participantCount} people are discussing this story
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Article Summary Box */}
        <div className="p-3.5 bg-zinc-900/90 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 mb-1">
            <span className="font-bold text-zinc-300">{article.sourceName}</span>
            <span>·</span>
            <span>{article.category}</span>
          </div>
          <h4 className="text-xs sm:text-sm font-bold text-zinc-100 line-clamp-2 leading-snug mb-2">
            {article.title}
          </h4>
          <div className="flex items-center justify-between gap-2 text-[10px]">
            <a
              href={article.articleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--neon-green)] hover:underline flex items-center gap-1"
            >
              <span>View Source</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>

            <button
              onClick={() => setShowRepostBox(!showRepostBox)}
              className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 flex items-center gap-1 cursor-pointer"
            >
              <Repeat2 className="w-3 h-3" />
              <span>Repost to FLICK Feed</span>
            </button>
          </div>

          {/* Repost Drawer */}
          {showRepostBox && (
            <div className="mt-2.5 p-2 bg-black border border-zinc-800 space-y-2">
              <input
                type="text"
                value={repostComment}
                onChange={(e) => setRepostComment(e.target.value)}
                placeholder="Add your own thought to this repost..."
                className="w-full bg-zinc-900 border border-zinc-800 px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-[var(--neon-green)]"
              />
              <div className="flex justify-end gap-1.5">
                <button
                  onClick={() => setShowRepostBox(false)}
                  className="px-2 py-0.5 text-[10px] text-zinc-400 bg-zinc-900"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRepost}
                  className="px-3 py-0.5 text-[10px] font-black bg-[var(--neon-green)] text-black uppercase"
                >
                  Broadcast Repost
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Comment Thread List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
          {comments.length === 0 ? (
            <div className="text-center py-10 text-xs text-zinc-500 font-mono space-y-2">
              <MessageSquare className="w-8 h-8 text-zinc-700 mx-auto" />
              <p>No community opinions recorded yet.</p>
              <p className="text-[10px] text-zinc-600">Be the first FLICK Citizen to post below!</p>
            </div>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="p-3 bg-zinc-900/70 border border-zinc-850 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-zinc-200">
                    <div className="w-4 h-4 bg-zinc-800 text-[var(--neon-green)] flex items-center justify-center text-[9px]">
                      {c.userName.charAt(0)}
                    </div>
                    <span>{c.userName}</span>
                    {c.userVerified && <CheckCircle2 className="w-3 h-3 text-[var(--neon-green)] fill-black" />}
                    {c.replyToUserName && (
                      <span className="text-zinc-500 text-[10px] font-normal">
                        ↳ Replying to @{c.replyToUserName}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-500">
                    {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <p className="text-xs text-zinc-300 font-sans leading-relaxed">
                  {c.content}
                </p>

                <div className="flex items-center gap-3 pt-1 text-[10px] text-zinc-500">
                  <button
                    onClick={() => {
                      setReplyTo({ id: c.id, name: c.userName });
                      playGlitchClickSound();
                    }}
                    className="hover:text-[var(--neon-green)] cursor-pointer flex items-center gap-1"
                  >
                    <CornerDownRight className="w-2.5 h-2.5" />
                    <span>Reply</span>
                  </button>
                  <button
                    onClick={() => {
                      newsService.reportContent(article.id, 'Comment violation', currentUser?.id, c.id);
                      alert('Comment report registered.');
                    }}
                    className="hover:text-rose-400 cursor-pointer"
                  >
                    Report
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input Footer */}
        <form onSubmit={handlePost} className="p-3 bg-zinc-900 border-t border-zinc-800 shrink-0">
          {replyTo && (
            <div className="flex items-center justify-between text-xs text-[var(--neon-green)] bg-black px-2.5 py-1 mb-2 border border-zinc-800">
              <span>Replying to @{replyTo.name}</span>
              <button type="button" onClick={() => setReplyTo(null)} className="text-zinc-500 hover:text-white">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={replyTo ? `Replying to ${replyTo.name}...` : "Write your comment to the FLICK community..."}
              className="flex-1 bg-black border border-zinc-800 px-3 py-2 text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[var(--neon-green)]"
            />
            <button
              type="submit"
              disabled={!newComment.trim() || isSubmitting}
              className="px-4 py-2 bg-[var(--neon-green)] hover:bg-emerald-400 disabled:opacity-50 text-black font-black text-xs uppercase transition flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="hidden sm:inline">SEND</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
