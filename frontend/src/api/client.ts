const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

// Posts
export interface Reply {
  id: string;
  post_id: string;
  reply_text: string;
  reply_index: number;
  model_used: string;
  is_favorite: boolean;
  was_used: boolean;
  generated_at: string;
}

export interface Post {
  id: string;
  account_id: string;
  batch_id: string | null;
  account_username: string;
  account_display_name: string | null;
  account_profile_image_url: string | null;
  external_post_id: string;
  post_url: string;
  text_content: string | null;
  has_media: boolean;
  media_urls: string[] | null;
  media_local_paths: string[] | null;
  post_type: string;
  posted_at: string;
  scraped_at: string;
  llm_status: string;
  replies: Reply[];
}

export interface PostList {
  posts: Post[];
  total: number;
  page: number;
  per_page: number;
}

export interface Account {
  id: string;
  username: string;
  display_name: string | null;
  x_user_id: string | null;
  profile_image_url: string | null;
  added_at: string;
  is_active: boolean;
  post_count: number;
}

export interface AccountList {
  accounts: Account[];
  total: number;
  page: number;
  per_page: number;
}

export interface Settings {
  openrouter_model: string;
  system_prompt: string;
  replies_per_post: number;
  openrouter_api_key: string;
  x_api_key: string;
}

export interface BulkResult {
  username: string;
  success: boolean;
  error: string | null;
}

// Retrieval batches
export interface RetrievalAccountInfo {
  id: string;
  username: string;
  display_name: string | null;
  profile_image_url: string | null;
}

export interface RetrievalBatch {
  id: string;
  created_at: string;
  since_dt: string | null;
  until_dt: string | null;
  status: string;
  error_message: string | null;
  accounts: RetrievalAccountInfo[];
  post_count: number;
}

export interface RetrievalBatchDetail extends RetrievalBatch {
  posts: Post[];
}

export interface RetrievalDefaults {
  since_dt: string;
  until_dt: string;
}

export interface RetrievalList {
  retrievals: RetrievalBatch[];
  total: number;
  page: number;
  per_page: number;
}

// API functions
export const api = {
  // Posts
  getPosts: (params: Record<string, string>) =>
    request<PostList>(`/posts?${new URLSearchParams(params)}`),
  getPost: (id: string) => request<Post>(`/posts/${id}`),
  regenerateReplies: (id: string) =>
    request<Post>(`/posts/${id}/regenerate`, { method: 'POST' }),

  // Accounts
  getAccounts: (params?: Record<string, string>) =>
    request<AccountList>(`/accounts${params ? '?' + new URLSearchParams(params) : ''}`),
  createAccount: (username: string) =>
    request<Account>('/accounts', { method: 'POST', body: JSON.stringify({ username }) }),
  bulkCreateAccounts: (usernames: string[]) =>
    request<{ results: BulkResult[] }>('/accounts/bulk', { method: 'POST', body: JSON.stringify({ usernames }) }),
  deleteAccount: (id: string) =>
    request<void>(`/accounts/${id}`, { method: 'DELETE' }),
  updateAccount: (id: string, data: { is_active?: boolean }) =>
    request<Account>(`/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Replies
  updateReply: (id: string, data: { is_favorite?: boolean; was_used?: boolean }) =>
    request<Reply>(`/replies/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Settings
  getSettings: () => request<Settings>('/settings'),
  updateSettings: (data: Partial<Settings>) =>
    request<Settings>('/settings', { method: 'PUT', body: JSON.stringify(data) }),

  // Retrievals
  getRetrievalDefaults: () => request<RetrievalDefaults>('/retrievals/defaults'),
  createRetrieval: (data: { account_ids: string[]; since_dt?: string; until_dt?: string }) =>
    request<RetrievalBatch>('/retrievals', { method: 'POST', body: JSON.stringify(data) }),
  getRetrievals: (params?: Record<string, string>) =>
    request<RetrievalList>(`/retrievals${params ? '?' + new URLSearchParams(params) : ''}`),
  getRetrieval: (id: string) => request<RetrievalBatchDetail>(`/retrievals/${id}`),

  // Health
  getHealth: () => request<{ status: string; db: string }>('/health'),
};
