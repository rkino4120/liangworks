<!-- /src/routes/+page.svelte -->
<script lang="ts">
	import { Canvas } from '@threlte/core';
	// 3Dシーンを管理する子コンポーネントをインポートします。
	// ファイルパスはプロジェクトの構成に合わせて調整してください。
	import ScrollScene from './ScrollScene.svelte';

let scrollPercent = 0;
let pageElement: HTMLDivElement;
let rafId: number | null = null;

function updateScrollPercent() {
	if (!pageElement) return;
	const { scrollTop, scrollHeight, clientHeight } = pageElement;
	const scrollableHeight = scrollHeight - clientHeight;
	if (scrollableHeight > 0) {
		scrollPercent = scrollTop / scrollableHeight;
	}
}

function handleScroll() {
	if (rafId !== null) {
		cancelAnimationFrame(rafId);
	}
	rafId = requestAnimationFrame(() => {
		updateScrollPercent();
		rafId = null;
	});
}
</script>

<div
	bind:this={pageElement}
	on:scroll={handleScroll}
	class="h-screen overflow-y-auto bg-gray-900 text-gray-100 font-sans"
>
	<div class="sticky top-0 left-0 w-full h-screen z-10">
		<Canvas>
			<!-- 
		子コンポーネントをCanvas内に配置し、
		計算したスクロール率を'scrollPercent'プロパティとして渡します。
	  -->
			<ScrollScene {scrollPercent} />
		</Canvas>
	</div>

	<!-- スクロール領域を確保するためのダミーコンテンツ -->
	<section class="h-screen flex flex-col justify-center items-center p-8 relative z-20 text-center">
		<h1 class="text-4xl sm:text-5xl lg:text-6xl font-extrabold mb-4 drop-shadow-lg">
			スクロールで始まる3D体験
		</h1>
		<p class="text-lg lg:text-xl max-w-xl leading-relaxed">Threlte v8 + TypeScript</p>
	</section>
	<section class="h-screen flex flex-col justify-center items-center p-8 relative z-20 text-center">
		<h2 class="text-3xl sm:text-4xl font-bold mb-6">特徴</h2>
		<ul class="list-none p-0 text-lg lg:text-xl max-w-xl leading-relaxed">
			<li class="bg-white/10 py-3 px-6 rounded-lg mb-3">DRACO圧縮されたGLBの読み込み</li>
			<li class="bg-white/10 py-3 px-6 rounded-lg mb-3">
				スクロールに連動した滑らかなカメラアニメーション
			</li>
			<li class="bg-white/10 py-3 px-6 rounded-lg mb-3">レスポンシブ対応のキャンバス</li>
		</ul>
	</section>
	<section class="h-screen flex flex-col justify-center items-center p-8 relative z-20 text-center">
		<h2 class="text-3xl sm:text-4xl font-bold mb-6">最後のステップ</h2>
		<p class="text-lg lg:text-xl max-w-xl leading-relaxed">
			スクロール量に応じてカメラの位置や<br>モデルの表示を調整しています。
		</p>
	</section>
</div>
