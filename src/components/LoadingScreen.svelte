<script lang="ts">
  export let visible = true
</script>

{#if visible}
<div class="fixed inset-0 w-screen h-screen flex justify-center items-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 z-[1000] opacity-100 transition-opacity duration-500">
  <div class="text-center text-white">
    <div class="w-16 h-16 border-4 border-white/10 border-l-white rounded-full animate-spin mx-auto mb-5"></div>
    <p class="text-lg font-light tracking-widest mb-8 opacity-90">3Dモデルを読み込み中...</p>
    <div class="w-48 h-1 bg-white/10 rounded-full overflow-hidden mx-auto">
      <div class="w-full h-full bg-gradient-to-r from-transparent via-white to-transparent animate-pulse-slide"></div>
    </div>
  </div>
</div>
{/if}

<style>
  @keyframes pulse-slide {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }

  .animate-pulse-slide {
    animation: pulse-slide 2s ease-in-out infinite;
  }
</style>
