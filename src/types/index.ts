// microCMS関連の型定義
export interface MicroCMSImage {
  url: string;
  width: number;
  height: number;
}

export interface BlogCategory {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  revisedAt?: string;
}

export interface BlogTag {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  revisedAt?: string;
}

// Astro関連の型定義
export interface AstroParams {
  id?: string;
  [key: string]: string | undefined;
}

// エラーハンドリング用の型
export interface APIError {
  message: string;
  status?: number;
  code?: string;
}

// ページネーション用の型
export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// フォームデータの型
export interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

// 環境変数の型定義
export interface ImportMetaEnv {
  readonly MICROCMS_SERVICE_DOMAIN: string;
  readonly MICROCMS_API_KEY: string;
  readonly VITE_MICROCMS_SERVICE_DOMAIN: string;
  readonly VITE_MICROCMS_API_KEY: string;
}

export interface ImportMeta {
  readonly env: ImportMetaEnv;
}
