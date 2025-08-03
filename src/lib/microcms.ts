import { createClient, type MicroCMSQueries, type MicroCMSContentId, type MicroCMSDate } from 'microcms-js-sdk';

if (!import.meta.env.MICROCMS_SERVICE_DOMAIN || !import.meta.env.MICROCMS_API_KEY) {
  throw new Error('microCMSの設定が不足しています。.envファイルを確認してください。');
}

export const client = createClient({
  serviceDomain: import.meta.env.MICROCMS_SERVICE_DOMAIN,
  apiKey: import.meta.env.MICROCMS_API_KEY,
});

// ブログ記事の型定義
export interface BlogPost extends MicroCMSContentId, MicroCMSDate {
  title: string;
  content: string;
  eyecatch?: {
    url: string;
    width: number;
    height: number;
  };
  category?: {
    id: string;
    name: string;
  };
  tags?: Array<{
    id: string;
    name: string;
  }>;
}

// API レスポンスの型定義
export interface BlogListResponse {
  contents: BlogPost[];
  totalCount: number;
  offset: number;
  limit: number;
}

// ブログ記事一覧取得関数
export async function getBlogPosts(queries?: MicroCMSQueries): Promise<BlogListResponse> {
  try {
    const response = await client.get<BlogListResponse>({
      endpoint: 'blogs', // microCMSのエンドポイント名（実際の名前に変更してください）
      queries: {
        limit: 100, // パフォーマンス向上のためデフォルト制限を設定
        ...queries,
      },
    });
    return response;
  } catch (error: unknown) {
    console.error('ブログ記事の取得に失敗しました:', error);
    throw error;
  }
}

// 特定のブログ記事取得関数
export async function getBlogPost(contentId: string, queries?: MicroCMSQueries): Promise<BlogPost> {
  try {
    const response = await client.get<BlogPost>({
      endpoint: 'blogs',
      contentId,
      queries,
    });
    return response;
  } catch (error: unknown) {
    console.error('ブログ記事の取得に失敗しました:', error);
    throw error;
  }
}
