// microCMS関連のユーティリティ関数

// 環境変数のチェック
export function checkEnvironmentVariables(): {
  serverSide: boolean;
  clientSide: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // サーバーサイド環境変数のチェック
  const serverSideDomain = import.meta.env.MICROCMS_SERVICE_DOMAIN;
  const serverSideApiKey = import.meta.env.MICROCMS_API_KEY;
  const hasServerSideConfig = !!(serverSideDomain && serverSideApiKey);
  
  if (!hasServerSideConfig) {
    errors.push('サーバーサイド用の環境変数（MICROCMS_SERVICE_DOMAIN, MICROCMS_API_KEY）が設定されていません');
  }
  
  // クライアントサイド環境変数のチェック
  const clientSideDomain = import.meta.env.VITE_MICROCMS_SERVICE_DOMAIN;
  const clientSideApiKey = import.meta.env.VITE_MICROCMS_API_KEY;
  const hasClientSideConfig = !!(clientSideDomain && clientSideApiKey);
  
  if (!hasClientSideConfig) {
    errors.push('クライアントサイド用の環境変数（VITE_MICROCMS_SERVICE_DOMAIN, VITE_MICROCMS_API_KEY）が設定されていません');
  }
  
  return {
    serverSide: hasServerSideConfig,
    clientSide: hasClientSideConfig,
    errors
  };
}

// エラーメッセージの生成
export function createMicroCMSErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes('401')) {
      return 'APIキーが無効です。microCMSの設定を確認してください。';
    }
    if (error.message.includes('404')) {
      return 'APIエンドポイントが見つかりません。エンドポイント名を確認してください。';
    }
    if (error.message.includes('403')) {
      return 'アクセス権限がありません。APIキーの権限を確認してください。';
    }
    return error.message;
  }
  return 'microCMSとの通信でエラーが発生しました。';
}

// 開発環境でのデバッグ情報表示
export function logEnvironmentInfo(): void {
  if (import.meta.env.DEV) {
    const envCheck = checkEnvironmentVariables();
    console.group('🔧 microCMS Environment Check');
    console.log('Server-side config:', envCheck.serverSide ? '✅' : '❌');
    console.log('Client-side config:', envCheck.clientSide ? '✅' : '❌');
    if (envCheck.errors.length > 0) {
      console.error('Errors:', envCheck.errors);
    }
    console.groupEnd();
  }
}
