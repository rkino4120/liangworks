<script lang="ts">
  import { T, Canvas } from '@threlte/core'
  // world
  import { Sky, Environment } from '@threlte/extras'
  import Water from './Water.svelte'
  import { onMount, onDestroy } from 'svelte'
  
  const baseFov = 60
  let cubeRef: any
  let sphereRef: any
  let time = 0
  let animationId: number
  let lastTime = 0

  // パフォーマンス最適化：定数を事前計算
  const CUBE_ROTATION_SPEED_Y = 0.2
  const CUBE_ROTATION_SPEED_X = 0.1
  const SPHERE_ROTATION_SPEED = 0.25
  const ANIMATION_SPEED = 0.5
  const PHASE_OFFSET = 0.5

  function animate(currentTime: number) {
    // 実際の経過時間を使用（フレームレート非依存）
    const deltaTime = (currentTime - lastTime) * 0.001 // ミリ秒を秒に変換
    lastTime = currentTime
    time += deltaTime
    
    if (cubeRef) {
      // ゆっくりとした上下運動
      cubeRef.position.y = 2 + Math.sin(time * ANIMATION_SPEED) * 1.5
      // 微妙な回転も追加
      cubeRef.rotation.y += deltaTime * CUBE_ROTATION_SPEED_Y
      cubeRef.rotation.x += deltaTime * CUBE_ROTATION_SPEED_X
    }
    
    if (sphereRef) {
      // 球体も立方体と同じような上下運動（少し位相をずらす）
      sphereRef.position.y = 2 + Math.sin(time * ANIMATION_SPEED + PHASE_OFFSET) * 1.2
      sphereRef.rotation.y += deltaTime * SPHERE_ROTATION_SPEED
    }
    
    animationId = requestAnimationFrame(animate)
  }

  onMount(() => {
    lastTime = performance.now()
    animate(lastTime)
  })

  onDestroy(() => {
    if (animationId) {
      cancelAnimationFrame(animationId)
    }
  })
</script>

<div class="fixed top-0 left-0 w-screen h-screen -z-10">
  <Canvas>
<T.PerspectiveCamera
  makeDefault
  position={[0, 1.5, 20]}
  fov={baseFov}
>

</T.PerspectiveCamera>

<!-- より自然な環境ライティング -->
<Environment 
  url="/images/belfast_sunset_puresky_1k.hdr"
  isBackground={false}
/>

<!-- World setup -->
<Sky
  elevation={0.3}
  azimuth={180}
  turbidity={3}
  rayleigh={2}
  mieCoefficient={0.005}
  mieDirectionalG={0.8}
/>
<Water />

<!-- 地面を追加 -->
<T.Mesh position={[0, -1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
  <T.PlaneGeometry args={[50, 50]} />
  <T.MeshStandardMaterial 
    color="#2d4a3e"
    roughness={0.8}
    metalness={0.1}
  />
</T.Mesh>

<!-- 金属質の立方体（より詳細な材質） -->
<T.Mesh bind:ref={cubeRef} position={[-2, 2, 0]} castShadow receiveShadow>
  <T.BoxGeometry args={[2, 2, 2]} />
  <T.MeshStandardMaterial 
    color="#c0c0c0"
    metalness={0.95}
    roughness={0.05}
    envMapIntensity={2}
  />
</T.Mesh>

<!-- 光沢のある球体 -->
<T.Mesh bind:ref={sphereRef} position={[4, 3, 0]} castShadow receiveShadow>
  <T.SphereGeometry args={[1.2, 24, 24]} />
  <T.MeshStandardMaterial 
    color="#ff6b6b"
    metalness={0.7}
    roughness={0.2}
    envMapIntensity={1.5}
  />
</T.Mesh>

<!-- 複数のライトでよりリアルな照明 -->
<T.AmbientLight intensity={0.2} />

<!-- メインの太陽光 -->
<T.DirectionalLight 
  position={[10, 15, 5]} 
  intensity={1.2}
  castShadow={true}
  shadow.mapSize.width={1024}
  shadow.mapSize.height={1024}
  shadow.camera.near={0.5}
  shadow.camera.far={30}
  shadow.camera.left={-15}
  shadow.camera.right={15}
  shadow.camera.top={15}
  shadow.camera.bottom={-15}
  color="#fff8e1"
/>

<!-- 補助光（青みがかった） -->
<T.DirectionalLight 
  position={[-8, 8, -5]} 
  intensity={0.3}
  color="#81d4fa"
/>

<!-- ポイントライト（暖色系アクセント） -->
<T.PointLight 
  position={[0, 8, 8]} 
  intensity={0.6}
  color="#ffb74d"
  decay={2}
  distance={20}
/>

</Canvas>
</div>
