<script lang="ts">
  import { Canvas } from '@threlte/core'
  import DotAnimation from './DotAnimation.svelte'
</script>

<div class="w-screen h-screen relative bg-gray-50 font-sans">
  <!-- 背景グラデーション -->
  <div class="absolute inset-0 bg-gradient-to-t from-cyan-200/40 via-transparent to-transparent"></div>
  
  <!-- 3Dキャンバス -->
  <Canvas>
    <DotAnimation />
  </Canvas>
  
  <!-- 左側のコピー -->
  <div class="absolute top-0 left-0 w-full h-full flex items-center pointer-events-none z-10">
    <div class="ml-8 w-full max-w-full md:ml-16 md:max-w-3xl">
      <h1 class="font-bold text-gray-800 tracking-tight text-4xl leading-snug break-words md:text-8xl md:leading-tight">
        Coding creates creativity.
      </h1>
    </div>
  </div>
</div>
