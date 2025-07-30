# Astro Starter Kit: Basics

```sh
npm create astro@latest -- --template basics
```

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/withastro/astro/tree/latest/examples/basics)
[![Open with CodeSandbox](https://assets.codesandbox.io/github/button-edit-lime.svg)](https://codesandbox.io/p/sandbox/github/withastro/astro/tree/latest/examples/basics)
[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/withastro/astro?devcontainer_path=.devcontainer/basics/devcontainer.json)

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

![just-the-basics](https://github.com/withastro/astro/assets/2244813/a0a5533c-a856-4198-8470-2d67b1d7c554)

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
│   └── favicon.svg
├── src
│   ├── assets
│   │   └── astro.svg
│   ├── components
│   │   └── Welcome.astro
│   ├── layouts
│   │   └── Layout.astro
│   └── pages
│       └── index.astro
└── package.json
```

To learn more about the folder structure of an Astro project, refer to [our guide on project structure](https://docs.astro.build/en/basics/project-structure/).

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).

# Astro Site with microCMS Blog

WebGL/3DコンテンツとmicroCMSを使用したブログ機能を持つAstroサイトです。

## 🚀 セットアップ

### 1. 依存関係のインストール

```sh
npm install
```

### 2. microCMSの設定

1. [microCMS](https://microcms.io/)でアカウントを作成
2. サービスを作成（例: `blog-service`）
3. APIを作成（例: `blogs`）
4. コンテンツモデルを設定:
   - `title`: テキストフィールド（必須）
   - `content`: リッチエディタ（必須）
   - `eyecatch`: 画像フィールド（任意）
   - `category`: 参照フィールド（任意）
   - `tags`: 複数参照フィールド（任意）
5. APIキーを取得

### 3. 環境変数の設定

`.env.example`を`.env`にコピーして、実際の値を設定してください：

```sh
cp .env.example .env
```

`.env`ファイルを編集：

```env
MICROCMS_SERVICE_DOMAIN=your-service-domain
MICROCMS_API_KEY=your-api-key
```

### 4. APIエンドポイントの設定

`src/lib/microcms.ts`の`endpoint`を実際のAPI名に変更してください：

```typescript
const response = await client.get({
  endpoint: 'blogs', // 実際のAPI名に変更
  queries,
});
```

## 🧞 コマンド

開発サーバーの起動：

```sh
npm run dev
```

本番ビルド：

```sh
npm run build
```

プレビュー：

```sh
npm run preview
```

## 📁 プロジェクト構造

```text
/
├── public/
│   ├── images/          # 画像ファイル
│   ├── glb/            # 3Dモデル
│   ├── mp3/            # 音声ファイル
│   └── texture/        # テクスチャファイル
├── src/
│   ├── components/
│   │   ├── blog.svelte         # ブログ一覧コンポーネント
│   │   ├── Photovr.tsx         # VRフォトビューア
│   │   ├── Oceandemo.svelte    # 海のデモ
│   │   └── ...
│   ├── lib/
│   │   └── microcms.ts         # microCMS設定とAPI
│   ├── layouts/
│   │   └── Layout.astro        # 共通レイアウト
│   └── pages/
│       ├── index.astro         # トップページ
│       ├── blog/
│       │   ├── index.astro     # ブログ一覧ページ
│       │   └── [id].astro      # ブログ詳細ページ
│       ├── babylon/            # Babylon.jsデモ
│       └── three/              # Three.jsデモ
```

## 🎨 機能

- **ブログ機能**: microCMSを使用したブログ記事の管理と表示
- **3Dコンテンツ**: Three.js、Babylon.jsを使用した3Dデモ
- **VRコンテンツ**: フォトVRビューア
- **レスポンシブデザイン**: モバイル対応

## 🔧 使用技術

- **Astro**: 静的サイトジェネレーター
- **Svelte**: リアクティブUIコンポーネント
- **React**: UIコンポーネント（一部）
- **TypeScript**: 型安全な開発
- **microCMS**: ヘッドレスCMS
- **Three.js**: 3Dグラフィックス
- **Babylon.js**: 3Dエンジン
- **TailwindCSS**: ユーティリティCSS

## 🔧 トラブルシューティング

### microCMS関連のエラー

#### `microCMSの設定が不足しています`エラー
- `.env`ファイルが存在し、正しい値が設定されているか確認
- 開発サーバーを再起動（環境変数の変更後は必須）
- サーバーサイド用とクライアントサイド用の両方の環境変数が設定されているか確認

#### APIキー関連のエラー
- microCMSでAPIキーが有効か確認
- 読み取り権限があるか確認
- クライアントサイド用には読み取り専用のAPIキーを使用

#### エンドポイントエラー
- `src/lib/microcms.ts`のエンドポイント名が実際のAPI名と一致しているか確認
- microCMSの管理画面でAPIが公開されているか確認

### 環境変数の設定

```env
# サーバーサイド用（秘匿情報）
MICROCMS_SERVICE_DOMAIN=your-service-domain
MICROCMS_API_KEY=your-api-key

# クライアントサイド用（公開される）
VITE_MICROCMS_SERVICE_DOMAIN=your-service-domain
VITE_MICROCMS_API_KEY=your-readonly-api-key
```

**注意**: `VITE_`プレフィックス付きの環境変数はクライアントサイドに公開されるため、読み取り専用のAPIキーを使用してください。
# liangworks
