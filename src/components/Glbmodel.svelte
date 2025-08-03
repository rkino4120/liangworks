<script lang="ts">
  import { T } from '@threlte/core'
  import { useGltf, useDraco, OrbitControls, Edges, SoftShadows } from '@threlte/extras'
  import { Float, Sky } from '@threlte/extras'
  import { createEventDispatcher, onMount, onDestroy } from 'svelte'

  const dispatch = createEventDispatcher()

  const dracoLoader = useDraco()
  
  const gltf = useGltf('/glb/redchair.glb', {
    dracoLoader
  })

  let isLoaded = false
  let mounted = false

  // GLTFの読み込み状態を監視
  $: if ($gltf && mounted) {
    if (!isLoaded) {
      isLoaded = true
      // 少し遅延してからロード完了を通知（レンダリング安定化のため）
      setTimeout(() => {
        dispatch('loaded')
      }, 100)
    }
  }

  onMount(() => {
    mounted = true
  })

  onDestroy(() => {
    mounted = false
  })
</script>


<T.PerspectiveCamera
  makeDefault
  position={[10, 10, 15]}
  fov={50}
  zoom={1}
>
  <OrbitControls 
    enableZoom={true}
    enablePan={false}
    target={[0, 1, 0]}
    enableDamping={true}
    dampingFactor={0.05}
    maxPolarAngle={Math.PI * 0.8}
    minPolarAngle={Math.PI * 0.1}
  />
</T.PerspectiveCamera>

<Sky elevation={0.5} />

<T.DirectionalLight
  castShadow
  position={[8, 20, -3]}
  intensity={5}
/>
<SoftShadows
  focus={20}
  size={5}
  samples={32}
/>
<T.AmbientLight intensity={0.2} />

<!-- 椅子モデル (Dynamic RigidBody) -->
{#if $gltf && isLoaded}
<Float
  floatIntensity={4}
  rotationIntensity={1}
>
  <T.Group position={[0, 0, 0]}>
    <T.Mesh is={$gltf.nodes.redchair} scale={2} castShadow receiveShadow>
      <Edges
        color="white"
        thresholdAngle={15}
      />
    </T.Mesh>
  </T.Group>
</Float>
{/if}
<T.Mesh
  receiveShadow
  position.y={-1}
  scale={20}
  rotation.x={-Math.PI / 2}
>
  <T.PlaneGeometry />
  <T.MeshStandardMaterial color="#0F141F" />
</T.Mesh>

