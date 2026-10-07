export interface NewsPublisher {
  id: string;
  name: string;
  logo: string;
  url: string;
  verified: boolean;
  categoryDefault?: string;
  country?: string;
  description?: string;
}

export interface NewsClusterSource {
  sourceId: string;
  sourceName: string;
  sourceLogo: string;
  articleUrl: string;
  title: string;
  publishedAt: string;
}

export interface NewsArticle {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceLogo: string;
  sourceUrl: string;
  verified?: boolean;
  articleUrl: string;
  title: string;
  excerpt: string;
  imageUrl?: string;
  category: 'Nigeria' | 'World' | 'Technology' | 'Business' | 'Sports' | 'Entertainment' | 'Science' | 'Campus' | string;
  subCategory?: string;
  author?: string;
  publishedAt: string; // ISO date string or formatted time
  updatedAt?: string;
  country?: string;
  region?: string;
  videoUrl?: string;
  duration?: string;
  readTime?: string;
  isBreaking?: boolean;
  isVideo?: boolean;
  viewCount: number;
  shareCount: number;
  commentCount: number;
  reactionCount: number;
  saveCount: number;
  userReacted?: boolean;
  userReactionType?: string;
  userSaved?: boolean;
  clusterSources?: NewsClusterSource[];
  status?: 'active' | 'archived' | 'reported';
  createdAt?: any;
}

export interface NewsComment {
  id: string;
  articleId: string;
  userId: string;
  userName: string;
  userUsername?: string;
  userPhoto?: string;
  userVerified?: boolean;
  content: string;
  replyToId?: string;
  replyToUserName?: string;
  likeCount: number;
  likes?: { [userId: string]: boolean };
  replyCount: number;
  createdAt: any;
  isEdited?: boolean;
  isReported?: boolean;
}

export interface CampusOption {
  id: string;
  name: string;
  shortName: string;
  state: string;
  type: 'Federal' | 'State' | 'Private';
  logo?: string;
}

export type NewsCategoryTab =
  | 'for-you'
  | 'trending'
  | 'following'
  | 'latest'
  | 'nigeria'
  | 'world'
  | 'technology'
  | 'business'
  | 'sports'
  | 'entertainment'
  | 'science'
  | 'campus'
  | 'saved'
  | 'video';

export interface FullArticleParagraph {
  type: 'p' | 'h2' | 'h3' | 'blockquote' | 'image' | 'list' | 'lead';
  text?: string;
  src?: string;
  caption?: string;
  items?: string[];
}

export interface FullArticleContent {
  id: string;
  articleUrl: string;
  title: string;
  byline?: string;
  sourceName: string;
  sourceLogo?: string;
  category: string;
  subCategory?: string;
  publishedAt: string;
  leadImage?: string;
  imageCaption?: string;
  readTime: string;
  wordCount: number;
  paragraphs: FullArticleParagraph[];
  summaryPoints?: string[];
  keyQuotes?: string[];
}

export interface InAppReaderPreferences {
  fontSize: 'sm' | 'base' | 'lg' | 'xl';
  theme: 'pitch' | 'dark' | 'sepia' | 'paper';
  speechRate: 1 | 1.25 | 1.5;
  viewMode: 'reader' | 'webview' | 'stream';
}

export interface NewsFilterOptions {
  sortBy: 'latest' | 'views' | 'comments' | 'shares' | 'reactions';
  timeFilter: 'all' | '24h' | '7d' | '30d';
  categoryFilter?: string;
  sourceFilter?: string;
  searchQuery?: string;
}

export interface NewsNotificationSettings {
  breakingNews: boolean;
  following: boolean;
  nigeria: boolean;
  technology: boolean;
  sports: boolean;
  campus: boolean;
  business: boolean;
}
