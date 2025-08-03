<script lang="ts">
  import Card from './Card.svelte';
  import { onMount, onDestroy } from 'svelte';
  import * as THREE from 'three';

  // --- 既存のポートフォリオロジック ---
  let items: any[] = [];
  let allItems: any[] = [];
  let allTags: string[] = [];
  let selectedTag: string = '';

  // --- ローディング状態管理 ---
  let isLoading = true;
  let loadingProgress = 0;

  // --- 3Dアニメーション用の変数 ---
  let canvasEl: HTMLCanvasElement | null;
  let renderer: THREE.WebGLRenderer | null;
  let scene: THREE.Scene | null;
  let camera: THREE.PerspectiveCamera | null;
  let cubes: THREE.Mesh[] = [];
  let animationFrameId: number;
  let isAnimating = false;
  let resizeTimeout: ReturnType<typeof setTimeout>;
  
  // パフォーマンス最適化用の変数
  let lastRenderTime = 0;
  const targetFPS = 60;
  const frameInterval = 1000 / targetFPS;

  onMount(async () => {
    // ローディングの開始
    isLoading = true;
    loadingProgress = 10;

    try {
      // --- 既存のデータフェッチ ---
      loadingProgress = 30;
      const res = await fetch('/items.json');
      allItems = await res.json();
      items = allItems;
      
      loadingProgress = 50;
      const tagSet = new Set<string>();
      allItems.forEach(item => {
        if (item.tags && Array.isArray(item.tags)) {
          item.tags.forEach((tag: string) => tagSet.add(tag));
        }
      });
      allTags = Array.from(tagSet).sort();

      loadingProgress = 70;
      // --- 3Dシーンの初期化 ---
      initThreeScene();
      
      loadingProgress = 90;
      // ウィンドウリサイズへの対応
      window.addEventListener('resize', handleResize);

      // 少し待ってからローディングを完了（スムーズな遷移のため）
      loadingProgress = 100;
      setTimeout(() => {
        isLoading = false;
      }, 500);
    } catch (error) {
      console.error('データの読み込みに失敗しました:', error);
      // エラーが発生してもローディングを終了
      setTimeout(() => {
        isLoading = false;
      }, 1000);
    }
  });

  onDestroy(() => {
    // --- パフォーマンス重視のクリーンアップ処理 ---
    isAnimating = false;
    
    // イベントリスナーの削除
    window.removeEventListener('resize', handleResize);
    
    // アニメーションフレームのキャンセル
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
    
    // タイムアウトのクリア
    if (resizeTimeout) {
      clearTimeout(resizeTimeout);
    }
    
    // Three.jsリソースの適切な解放
    if (renderer) {
        // レンダラーの停止とリソース解放
        renderer.setAnimationLoop(null);
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove?.();
    }
    
    if (scene) {
        // シーン内のすべてのオブジェクトを解放
        scene.traverse(object => {
            if (object instanceof THREE.Mesh) {
                if (object.geometry) {
                    object.geometry.dispose();
                }
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(material => {
                            if (material.map) material.map.dispose();
                            material.dispose();
                        });
                    } else {
                        if (object.material.map) object.material.map.dispose();
                        object.material.dispose();
                    }
                }
            }
        });
        scene.clear();
    }
    
    // 配列のクリア
    cubes.length = 0;
    
    // 変数のリセット
    renderer = null;
    scene = null;
    camera = null;
    canvasEl = null;
  });

  function filterByTag(tag: string) {
    selectedTag = tag;
    if (tag === '') {
      items = allItems;
    } else {
      items = allItems.filter(item => 
        item.tags && item.tags.includes(tag)
      );
    }
  }

  function showAll() {
    filterByTag('');
  }

  // --- 3Dシーンをセットアップする関数 ---
  function initThreeScene() {
    scene = new THREE.Scene();
    
    // カメラの作成
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    // canvasElがnullでないことを確認
    if (!canvasEl) {
      console.error('canvasEl is null. 3Dシーンの初期化を中止します。');
      return;
    }

    // レンダラーの作成（パフォーマンス最適化強化）
    renderer = new THREE.WebGLRenderer({ 
      canvas: canvasEl, 
      alpha: true, 
      antialias: window.devicePixelRatio <= 1.5, // より厳しい条件でアンチエイリアス制御
      powerPreference: "high-performance",
      stencil: false,
      depth: true,
      logarithmicDepthBuffer: false,
      preserveDrawingBuffer: false
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // ピクセル比を制限
    
    // パフォーマンス設定強化
    renderer.shadowMap.enabled = false;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.autoClear = true;
    renderer.autoClearColor = true;
    renderer.autoClearDepth = true;
    renderer.autoClearStencil = false;

    // ライトの追加（パフォーマンス最適化）
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);
    
    // 追加のライトを少し弱めてパフォーマンス向上
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
    directionalLight2.position.set(-3, -3, 2);
    scene.add(directionalLight2);

    // 共有ジオメトリとマテリアルでメモリ使用量を削減（サイズを大きく）
    const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    const materials: THREE.MeshStandardMaterial[] = [];
    
    // 少数のマテリアルを作成してキューブ間で共有（より鮮明で美しい色合い）
    const colors = [
      0xff4757, 0x2ed573, 0x3742fa, 0xff6348, 0xffa502, 
      0x7bed9f, 0x70a1ff, 0xeccc68, 0xff7675, 0x6c5ce7
    ];
    
    colors.forEach(color => {
      materials.push(new THREE.MeshStandardMaterial({ 
        color: color,
        metalness: 0.3,
        roughness: 0.4,
        transparent: false,
        opacity: 1.0,
      }));
    });

    // キューブを作成（パフォーマンス重視で数を最適化）
    const cubeCount = window.innerWidth < 768 ? 15 : 20; // モバイルでは数を減らす
    for (let i = 0; i < cubeCount; i++) {
        const materialIndex = i % materials.length;
        const cube = new THREE.Mesh(geometry, materials[materialIndex]);
        
        // 位置をより効率的に配置
        cube.position.set(
            (Math.random() - 0.5) * 12,
            (Math.random() - 0.5) * 12,
            (Math.random() - 0.5) * 12
        );
        cube.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            0
        );
        
        // カスタムプロパティでアニメーション速度を保持（最適化）
        (cube as any).rotationSpeed = {
            x: (Math.random() - 0.5) * 0.01,
            y: (Math.random() - 0.5) * 0.01,
        };
        
        // Frustum culling最適化のため
        cube.matrixAutoUpdate = true;

        cubes.push(cube);
        scene.add(cube);
    }

    // アニメーションループを開始
    isAnimating = true;
    animate();
  }

  // --- アニメーションループ（パフォーマンス最適化版） ---
  function animate(currentTime = 0) {
    if (!isAnimating) return;
    
    // フレームレート制御
    if (currentTime - lastRenderTime < frameInterval) {
      animationFrameId = requestAnimationFrame(animate);
      return;
    }
    lastRenderTime = currentTime;
    
    animationFrameId = requestAnimationFrame(animate);

    // キューブを回転させる（最適化：事前計算された値を使用）
    const cubesLength = cubes.length;
    for (let i = 0; i < cubesLength; i++) {
      const cube = cubes[i];
      const rotSpeed = (cube as any).rotationSpeed;
      cube.rotation.x += rotSpeed.x;
      cube.rotation.y += rotSpeed.y;
    }

    // カメラを少しだけ動かす（最適化：計算回数を削減）
    const time = currentTime * 0.00008;
    const sinTime = Math.sin(time) * 0.25;
    const cosTime = Math.cos(time) * 0.25;
    
    if (camera) {
      camera.position.x = sinTime;
      camera.position.y = cosTime;
      camera.lookAt(0, 0, 0);
    }

    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }
  }

  // --- ウィンドウリサイズ処理（パフォーマンス最適化版） ---
  function handleResize() {
    if (resizeTimeout) {
      clearTimeout(resizeTimeout);
    }
    
    resizeTimeout = setTimeout(() => {
      if (camera && renderer) {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        // アスペクト比の更新
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        
        // レンダラーサイズの更新（ピクセル比を制限）
        renderer.setSize(width, height, false); // updateStyleをfalseでDOM更新を削減
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      }
    }, 150); // デバウンス時間を少し長めに
  }

</script>

<!-- 
  3Dキャンバスを背景に配置し、メインコンテンツをその上に重ねる構造
-->
<div class="relative w-full min-h-screen overflow-x-hidden">
  <!-- ローディング画面 -->
  {#if isLoading}
    <div class="fixed inset-0 bg-gradient-to-br from-blue-50 to-indigo-100 z-50 flex items-center justify-center loading-fade-in">
      <div class="text-center">
        <!-- ロゴ・タイトル -->
        <h1 class="text-4xl md:text-6xl font-light text-gray-800 mb-8 loading-pulse tracking-widest refined-title">Liang Works</h1>
        
        <!-- ローディングスピナー -->
        <div class="relative w-20 h-20 mx-auto mb-6">
          <div class="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
          <div class="absolute inset-0 border-4 border-blue-500 rounded-full animate-spin border-t-transparent"></div>
        </div>
        
        <!-- プログレスバー -->
        <div class="w-64 bg-gray-200 rounded-full h-2 mx-auto mb-4">
          <div 
            class="progress-gradient h-2 rounded-full transition-all duration-300 ease-out"
            style="width: {loadingProgress}%"
          ></div>
        </div>
        
        <!-- プログレステキスト -->
        <p class="text-gray-600 text-sm">
          読み込み中... {loadingProgress}%
        </p>
        
        <!-- 3Dキューブアニメーション -->
        <div class="mt-8 flex justify-center space-x-2">
          <div class="w-3 h-3 bg-blue-500 rounded animate-bounce" style="animation-delay: 0ms;"></div>
          <div class="w-3 h-3 bg-blue-500 rounded animate-bounce" style="animation-delay: 150ms;"></div>
          <div class="w-3 h-3 bg-blue-500 rounded animate-bounce" style="animation-delay: 300ms;"></div>
        </div>
      </div>
    </div>
  {/if}

  <!-- 3Dアニメーション用キャンバス -->
  <div class="fixed top-0 left-0 w-full h-full pointer-events-none z-0">
    <canvas bind:this={canvasEl}></canvas>
  </div>

  <!-- メインコンテンツ -->
  <div class="relative z-10 bg-gray-100/80 backdrop-blur-sm min-h-screen" class:opacity-0={isLoading} class:opacity-100={!isLoading} style="transition: opacity 0.5s ease-in-out;">
    <!-- ヒーローセクション -->
    <div class="relative w-full h-80 mb-8 flex items-center justify-center">
      <!-- リンクボタン（右上） -->
      <div class="absolute top-6 right-6 flex gap-3">
        <a 
          href="/blog" 
          class="px-6 py-3 bg-white/90 hover:bg-white text-gray-800 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 text-base font-semibold border border-gray-200"
        >
          ブログ
        </a>
        <a 
          href="https://forms.gle/nYTiK3SpQf5YXqKR7" 
          target="_blank" 
          rel="noopener noreferrer"
          class="px-6 py-3 bg-blue-500/90 hover:bg-blue-500 text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 text-base font-semibold border border-blue-500"
        >
          お問合せ
        </a>
      </div>
      <h1 class="text-5xl md:text-6xl font-light text-gray-900 text-center drop-shadow-lg tracking-widest refined-title">Liang Works</h1>
    </div>
    
    <div class="px-4 sm:px-6 md:px-8 pb-8">

      <!-- タグフィルターボタン -->
      <div class="max-w-6xl mx-auto mb-8">
        <div class="flex flex-wrap gap-2 justify-center">
          <button 
            class="px-4 py-2 rounded-full border transition-colors duration-200 {selectedTag === '' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white/80 text-gray-700 border-gray-300 hover:bg-gray-50'}"
            on:click={showAll}
          >
            全て
          </button>
          {#each allTags as tag}
            <button 
              class="px-4 py-2 rounded-full border transition-colors duration-200 {selectedTag === tag ? 'bg-blue-500 text-white border-blue-500' : 'bg-white/80 text-gray-700 border-gray-300 hover:bg-gray-50'}"
              on:click={() => filterByTag(tag)}
            >
              {tag}
            </button>
          {/each}
        </div>
      </div>

      <!-- アイテムリスト -->
      <ul class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
        {#each items as item}
          <li class="list-none"><Card {...item} /></li>
        {/each}
      </ul>

      <!-- プロフィールセクション -->
      <div class="max-w-4xl mx-auto mt-20 p-8 bg-white/90 rounded-xl shadow-md flex flex-col sm:flex-row items-center gap-8 border border-gray-200">
        <img 
          src="/images/profile.jpg" 
          alt="プロフィール写真"
          class="w-32 h-32 md:w-36 md:h-36 rounded-md object-cover border-4 border-white shadow-sm"
        >
        <div class="text-center sm:text-left">
          <h2 class="text-2xl font-bold text-gray-800">Liang</h2>
          <p class="text-gray-600 mt-2 leading-relaxed">
            台湾で7年住み、現在は大阪在住。ブラウザで3Dを表現するために日々勉強中。
          </p>
          <div class="mt-4">
            <h3 class="text-lg font-semibold text-gray-700 mb-3">スキルセット</h3>
            <div class="flex flex-wrap gap-2 justify-center sm:justify-start">
              <span class="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">Three.js</span>
              <span class="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">Babylon.js</span>
              <span class="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">WebGL</span>
              <span class="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-medium">React</span>
              <span class="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">Blender</span>
              <span class="px-3 py-1 bg-teal-100 text-teal-800 rounded-full text-sm font-medium">Astro</span>
              <span class="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-medium">Svelte</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 著作権注意書き -->
      <div class="max-w-6xl mx-auto mt-12 pt-8 border-t border-gray-300">
        <p class="text-sm text-gray-600 text-center leading-relaxed">
          一部マテリアル素材を除き、写真やスクリプトは管理人であるLiangの著作物です。<br>
          無断転載や改変はご遠慮ください。
        </p>
        <p class="text-xs text-gray-500 text-center mt-4">
          &copy; Liang Works 2025.
        </p>
      </div>
    </div>
  </div>
</div>

<style>
  /* カスタムアニメーション */
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes pulse {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.05);
    }
  }

  /* ローディング画面のアニメーション */
  :global(.loading-fade-in) {
    animation: fadeIn 0.8s ease-out;
  }

  :global(.loading-pulse) {
    animation: pulse 2s infinite;
  }

  /* スムーズなトランジション */
  :global(.smooth-transition) {
    transition: all 0.3s ease-in-out;
  }

  /* プログレスバーのグラデーション */
  :global(.progress-gradient) {
    background: linear-gradient(90deg, #3b82f6, #1d4ed8, #3b82f6);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }

  /* 洗練されたタイトルフォント */
  :global(.refined-title) {
    font-family: 'Helvetica Neue', 'Arial', 'Segoe UI', sans-serif;
    font-weight: 300;
    letter-spacing: 0.1em;
    color: #1f2937;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
</style>