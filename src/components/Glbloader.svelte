<script lang="ts">
  import { Canvas } from '@threlte/core'
  import Glbmodel from './Glbmodel.svelte'
  import LoadingScreen from './LoadingScreen.svelte'
  import { onMount } from 'svelte'

  let isLoading = true
  let showContent = false

  function handleLoaded() {
    // スムーズな遷移のために少し遅延
    setTimeout(() => {
      isLoading = false
      setTimeout(() => {
        showContent = true
      }, 200)
    }, 500)
  }

  onMount(() => {
    // フォールバック: 8秒後に強制的に表示
    setTimeout(() => {
      if (isLoading) {
        isLoading = false
        setTimeout(() => {
          showContent = true
        }, 200)
      }
    }, 8000)
  })
</script>

<div class="glb-container">
  <!-- ローディング画面 -->
  <LoadingScreen visible={isLoading} />

  <!-- 3Dキャンバス -->
  <div class="canvas-wrapper" class:visible={showContent}>
    <Canvas>
      <Glbmodel on:loaded={handleLoaded} />
    </Canvas>
  </div>
</div>

<style>
  .glb-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: -10;
  }

  .canvas-wrapper {
    width: 100%;
    height: 100%;
    opacity: 0;
    transform: scale(1.05);
    transition: opacity 0.8s ease-in-out, transform 0.8s ease-in-out;
  }

  .canvas-wrapper.visible {
    opacity: 1;
    transform: scale(1);
  }
</style>