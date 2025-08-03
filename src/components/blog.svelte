<script lang="ts">
  import { onMount } from 'svelte';
  import type { BlogPost, BlogListResponse } from '../lib/microcms';

  // プロップス
  export let initialData: BlogListResponse | null = null;
  export let initialError: string | null = null;

  let blogPosts: BlogPost[] = [];
  let loading: boolean = true;
  let error: string | null = null;
  let currentPage: number = 1;
  let totalCount: number = 0;
  const postsPerPage: number = 10;

  // メモ化された計算値
  $: totalPages = Math.ceil(totalCount / postsPerPage);
  $: hasPrevPage = currentPage > 1;
  $: hasNextPage = currentPage < totalPages;

  // クライアントサイドでのmicroCMS呼び出し用
  let microCMSClient: any = null;

  // 動的にmicroCMSクライアントを初期化
  async function initializeMicroCMS() {
    try {
      // クライアントサイドでのみmicroCMSを初期化
      if (typeof window !== 'undefined') {
        const { createClient } = await import('microcms-js-sdk');
        
        // 公開用の環境変数を使用（VITE_プレフィックス）
        const serviceDomain = import.meta.env.VITE_MICROCMS_SERVICE_DOMAIN;
        const apiKey = import.meta.env.VITE_MICROCMS_API_KEY;
        
        if (!serviceDomain || !apiKey) {
          throw new Error('microCMSの設定が不足しています。環境変数を確認してください。');
        }

        microCMSClient = createClient({
          serviceDomain,
          apiKey,
        });
      }
    } catch (err: unknown) {
      console.error('microCMSクライアントの初期化に失敗しました:', err);
    }
  }

  // ブログ記事を取得する関数（クライアントサイド用）
  async function fetchBlogPosts(page: number = 1): Promise<void> {
    if (!microCMSClient) {
      console.error('microCMSクライアントが初期化されていません');
      return;
    }

    try {
      loading = true;
      error = null;
      const offset: number = (page - 1) * postsPerPage;
      
      const response: BlogListResponse = await microCMSClient.get({
        endpoint: 'blogs',
        queries: {
          limit: postsPerPage,
          offset: offset,
          orders: '-publishedAt',
        },
      });
      
      blogPosts = response.contents;
      totalCount = response.totalCount;
      currentPage = page;
    } catch (err: unknown) {
      console.error('ブログ記事の取得に失敗しました:', err);
      error = 'ブログ記事の取得に失敗しました。しばらく時間をおいて再度お試しください。';
    } finally {
      loading = false;
    }
  }

  // ページ変更（最適化されたバージョン）
  function changePage(page: number): void {
    if (page > 0 && page <= totalPages && page !== currentPage) {
      fetchBlogPosts(page);
    }
  }

  // 前のページに移動
  const goToPrevPage = () => changePage(currentPage - 1);
  
  // 次のページに移動
  const goToNextPage = () => changePage(currentPage + 1);

  // 日付のフォーマット（メモ化）
  const formatDateMemo = (() => {
    const cache = new Map<string, string>();
    return (dateString: string): string => {
      if (cache.has(dateString)) {
        return cache.get(dateString)!;
      }
      const date: Date = new Date(dateString);
      const formatted = date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      cache.set(dateString, formatted);
      return formatted;
    };
  })();

  // 日付のフォーマット
  function formatDate(dateString: string): string {
    return formatDateMemo(dateString);
  }

  // コンポーネントマウント時の処理
  onMount(async (): Promise<void> => {
    // 初期データがある場合はそれを使用
    if (initialData) {
      blogPosts = initialData.contents;
      totalCount = initialData.totalCount;
      currentPage = 1;
      loading = false;
    } else if (initialError) {
      error = initialError;
      loading = false;
    } else {
      // 初期データがない場合はクライアントサイドで取得
      await initializeMicroCMS();
      if (microCMSClient) {
        await fetchBlogPosts();
      } else {
        error = 'microCMSの初期化に失敗しました。';
        loading = false;
      }
    }
  });
</script>

<div class="max-w-7xl mx-auto px-4 py-8 relative">
  <!-- TOPページに戻るボタン（右上） -->
  <a 
    href="/" 
    class="absolute top-6 right-4 px-6 py-3 bg-white hover:bg-gray-50 text-gray-800 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 text-base font-semibold border border-gray-200"
  >
    TOPページに戻る
  </a>
  
  <h2 class="text-4xl font-bold text-center mt-16 mb-12 text-gray-900">ブログ記事一覧</h2>
  
  {#if loading}
    <div class="flex flex-col items-center justify-center py-16">
      <div class="w-10 h-10 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
      <p class="text-gray-600">読み込み中...</p>
    </div>
  {:else if error}
    <div class="text-center p-8 bg-red-50 border border-red-200 rounded-lg text-red-700 max-w-md mx-auto">
      <p class="mb-4">{error}</p>
      <button 
        on:click={() => fetchBlogPosts(currentPage)} 
        class="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors duration-200"
      >
        再試行
      </button>
    </div>
  {:else if blogPosts.length === 0}
    <div class="text-center py-16">
      <p class="text-gray-500 text-lg">ブログ記事が見つかりませんでした。</p>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
      {#each blogPosts as post (post.id)}
        <article class="bg-white rounded-xl shadow-lg overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
          {#if post.eyecatch?.url}
            <div class="h-48 overflow-hidden">
              <a href={`/blog/${post.id}`} tabindex="-1">
                <img 
                  src={post.eyecatch.url} 
                  alt={post.title} 
                  loading="lazy" 
                  decoding="async"
                  class="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                  style="content-visibility: auto;"
                />
              </a>
            </div>
          {/if}
          
          <div class="p-6">
            <h3 class="mb-4 text-xl font-semibold leading-tight">
              <a 
                href={`/blog/${post.id}`} 
                class="text-gray-900 hover:text-blue-600 transition-colors duration-200 no-underline"
              >
                {post.title}
              </a>
            </h3>
            
            <div class="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mb-4 text-sm text-gray-600">
              <time datetime={post.publishedAt || post.createdAt}>
                {formatDate(post.publishedAt || post.createdAt)}
              </time>
              
              {#if post.category}
                <span class="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-medium">
                  {post.category.name}
                </span>
              {/if}
            </div>
            
            {#if post.tags && post.tags.length > 0}
              <div class="flex flex-wrap gap-2">
                {#each post.tags as tag (tag.id)}
                  <span class="bg-teal-50 text-teal-700 px-2 py-1 rounded text-xs">
                    {tag.name}
                  </span>
                {/each}
              </div>
            {/if}
          </div>
        </article>
      {/each}
    </div>
    
    <!-- ページネーション -->
    {#if totalPages > 1}
      <nav class="flex flex-col md:flex-row justify-center items-center gap-4 mt-8">
        <button 
          on:click={goToPrevPage}
          disabled={!hasPrevPage}
          class="px-6 py-3 bg-blue-600 text-white rounded-md font-medium transition-colors duration-200 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed w-full md:w-auto max-w-xs"
        >
          前のページ
        </button>
        
        <span class="font-medium text-gray-700">
          {currentPage} / {totalPages}
        </span>
        
        <button 
          on:click={goToNextPage}
          disabled={!hasNextPage}
          class="px-6 py-3 bg-blue-600 text-white rounded-md font-medium transition-colors duration-200 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed w-full md:w-auto max-w-xs"
        >
          次のページ
        </button>
      </nav>
    {/if}
  {/if}
</div>

