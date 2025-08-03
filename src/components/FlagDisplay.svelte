<!-- 
  FlagDisplay.svelte
  複数の旗を横に並べて表示するコンポーネント
-->
<script lang="ts">
  import { Canvas } from '@threlte/core'
  import { T } from '@threlte/core'
  import { Text } from '@threlte/extras'
  import ImageScene from './ImageScene.svelte'

  // 旗の設定データ
  type Flag = {
    position: [number, number, number],
    imageUrl: string,
    floatSpeed?: number,
    rotationIntensity?: number,
    floatingRange?: [number, number]
  }

  const flags: Flag[] = [
    {
      position: [-12, 0, 0],
      imageUrl: '/images/photo01.jpg',
      floatSpeed: 0.6,
      rotationIntensity: 0.12,
      floatingRange: [-0.2, 0.4]
    },
    {
      position: [-6, 0, 0],
      imageUrl: '/images/photo02.jpg',
      floatSpeed: 0.8,
      rotationIntensity: 0.15,
      floatingRange: [-0.3, 0.3]
    },
    {
      position: [0, 0, 0],
      imageUrl: '/images/photo04.jpg',
      floatSpeed: 1.0,
      rotationIntensity: 0.18,
      floatingRange: [-0.4, 0.2]
    },
    {
      position: [6, 0, 0],
      imageUrl: '/images/photo07.jpg',
      floatSpeed: 0.7,
      rotationIntensity: 0.13,
      floatingRange: [-0.1, 0.5]
    },
    {
      position: [12, 0, 0],
      imageUrl: '/images/photo08.jpg',
      floatSpeed: 0.9,
      rotationIntensity: 0.16,
      floatingRange: [-0.5, 0.1]
    }
  ]
</script>

<div class="w-screen h-screen fixed top-0 left-0 bg-gradient-to-b from-sky-300 via-sky-200 to-sky-100">
  <Canvas>
    <T.PerspectiveCamera makeDefault position={[-15, -1, 12]} fov={50} rotation={[0, -0.7, 0]} />

    <!-- 環境光（少し暗めにしてコントラストを向上） -->
    <T.AmbientLight intensity={0.1} color="#ffffff" />
    <!-- メインの平行光源（太陽光のような暖かい光） -->
    <T.DirectionalLight position={[10, 10, 5]} intensity={5.0} color="#ffd700" />

    <!-- 複数の旗を横に並べて表示 -->
    {#each flags as flag}
      <ImageScene 
        position={flag.position}
        imageUrl={flag.imageUrl}
        floatSpeed={flag.floatSpeed}
        rotationIntensity={flag.rotationIntensity}
        floatingRange={flag.floatingRange}
      />
    {/each}

    <!-- 3D空間にテキストを配置 -->
    <Text 
      text="Taiwan's Labyrinth"
      position={[-0.3, -3.2, 2.5]}
      rotation={[0, -0.7, 0]}
      fontSize={2.5}
      color="#ffffff"
      anchorX="center"
      anchorY="middle"
      fillOpacity={1.0}
      strokeWidth={0.05}
      strokeColor="#ffffff"
    />
  </Canvas>
</div>


