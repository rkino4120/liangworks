<!-- 
  WavingImage.svelte
  Threlte v8 と TypeScript を使用して、画像が布のようにはためくコンポーネントです。
  @threlte/core と @threlte/extras がインストールされている必要があります。
  npm install @threlte/core @threlte/extras three @types/three
-->
<script lang="ts">
  import { T, useTask } from '@threlte/core'
  // ★修正点: OrbitControls のインポートを削除
  // import { OrbitControls } from '@threlte/extras'
  import { interactivity } from '@threlte/extras';
  import { Float } from '@threlte/extras';
  import { Texture, ShaderMaterial, Vector2, TextureLoader, DoubleSide } from 'three'
  import { onMount } from 'svelte'
  interactivity()

  // --- 設定項目 ---
  // ★修正点: 確実に読み込めるプレースホルダー画像のURLに変更
  export let imageUrl = 'https://placehold.co/600x900/e2e8f0/4a5568?text=Waving+Image'
  // 旗の位置
  export let position: [number, number, number] = [0, 0, 0]
  // Float設定
  export let floatSpeed = 0.8
  export let rotationIntensity = 0.15
  export let floatingRange: [number, number] = [-0.3, 0.3]
  // 旗のサイズ（画像の縦横比 1365:2048 ≈ 0.667 に合わせて調整）
  const clothSize = { width: 4, height: 6 }
  // 布の分割数（パフォーマンス重視で最適化）
  const clothSegments = { width: 25, height: 35 }
  // --- 設定項目ここまで ---

  // テクスチャとマテリアルの変数を準備
  let texture: Texture
  let material: ShaderMaterial
  let meshRef: any // メッシュの参照を保持
  
  // マウスホバー状態を管理
  let isMouseOver = false
  // マウスの位置（UV座標系で0-1の範囲）
  let mousePosition = new Vector2(0.5, 0.5)
  // 前回のマウス位置を保持
  let lastMousePosition = new Vector2(0.5, 0.5)
  // 複数の波を管理する配列
  type Wave = { position: Vector2; startTime: number; active: boolean }
  let waves: Wave[] = []
  // 波の最大数（パフォーマンス重視で削減）
  const maxWaves = 3

  // シェーダーのuniforms（シェーダーに渡す動的な値）
  const uniforms = {
    // 時間（アニメーション用）
    uTime: { value: 0 },
    // 画像テクスチャ
    uTexture: { value: new Texture() },
    // 風の強度（0.0～1.0）- 通常時は無風
    uWindStrength: { value: 0.0 },
    // 風の方向（X, Y）
    uWindDirection: { value: new Vector2(1.0, 0.3) },
    // 波の周波数（複数の波を重ねる）- より高い周波数で速い動き
    uFrequency1: { value: new Vector2(2.0, 1.4) },
    uFrequency2: { value: new Vector2(4.2, 2.8) },
    uFrequency3: { value: new Vector2(1.2, 3.5) },
    // 各波の振幅 - より大きな振幅
    uAmplitude1: { value: 0.25 },
    uAmplitude2: { value: 0.15 },
    uAmplitude3: { value: 0.12 },
    // マウスホバー効果
    uMouseHover: { value: 0.0 },
    // マウス位置
    uMousePosition: { value: new Vector2(0, 0) },
    // 波の配列（最大5つの波）
    uWave1StartTime: { value: -10.0 },
    uWave1Position: { value: new Vector2(0, 0) },
    uWave1Active: { value: 0.0 },
    uWave2StartTime: { value: -10.0 },
    uWave2Position: { value: new Vector2(0, 0) },
    uWave2Active: { value: 0.0 },
    uWave3StartTime: { value: -10.0 },
    uWave3Position: { value: new Vector2(0, 0) },
    uWave3Active: { value: 0.0 },
    uWave4StartTime: { value: -10.0 },
    uWave4Position: { value: new Vector2(0, 0) },
    uWave4Active: { value: 0.0 },
    uWave5StartTime: { value: -10.0 },
    uWave5Position: { value: new Vector2(0, 0) },
    uWave5Active: { value: 0.0 },
  }

  // 頂点シェーダー (GLSL)
  // 各頂点の位置を計算します。
  const vertexShader = `
    uniform float uTime;
    uniform float uWindStrength;
    uniform vec2 uWindDirection;
    uniform vec2 uFrequency1;
    uniform vec2 uFrequency2;
    uniform vec2 uFrequency3;
    uniform float uAmplitude1;
    uniform float uAmplitude2;
    uniform float uAmplitude3;
    uniform float uMouseHover;
    uniform vec2 uMousePosition;
    // 複数の波のユニフォーム
    uniform float uWave1StartTime;
    uniform vec2 uWave1Position;
    uniform float uWave1Active;
    uniform float uWave2StartTime;
    uniform vec2 uWave2Position;
    uniform float uWave2Active;
    uniform float uWave3StartTime;
    uniform vec2 uWave3Position;
    uniform float uWave3Active;
    uniform float uWave4StartTime;
    uniform vec2 uWave4Position;
    uniform float uWave4Active;
    uniform float uWave5StartTime;
    uniform vec2 uWave5Position;
    uniform float uWave5Active;
    
    // フラグメントシェーダーに渡す変数
    varying vec2 vUv;
    varying vec3 vNormal;

    void main() {
      // UV座標をフラグメントシェーダーに渡す
      vUv = uv;

      // 元の頂点位置をコピー
      vec3 pos = position;
      
      // 通常時は静止状態、すべての波が非アクティブの場合のみ停止
      if (uWave1Active < 0.5 && uWave2Active < 0.5 && uWave3Active < 0.5) {
        // 法線はデフォルトのまま
        vNormal = normal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        return;
      }
      
      // マウス位置から頂点までの距離を計算（UV座標で）
      vec2 vertexUV = uv; // 直接UV座標を使用
      
      float totalWave = 0.0;
      
      // Wave 1
      if (uWave1Active > 0.5) {
        float distanceFromWave1 = distance(vertexUV, uWave1Position);
        float waveTime1 = uTime - uWave1StartTime;
        float waveDuration1 = 2.0;
        
        if (waveTime1 <= waveDuration1) {
          float timeAttenuation1 = 1.0 - smoothstep(0.0, waveDuration1, waveTime1);
          float waveRadius1 = waveTime1 * 0.6;
          float waveFront1 = abs(distanceFromWave1 - waveRadius1);
          float spatialAttenuation1 = 1.0 - smoothstep(0.0, 0.25, waveFront1);
          float totalAttenuation1 = spatialAttenuation1 * timeAttenuation1;
          float wavePhase1 = (distanceFromWave1 - waveRadius1) * 8.0;
          totalWave += sin(wavePhase1) * 0.3 * totalAttenuation1;
        }
      }
      
      // Wave 2
      if (uWave2Active > 0.5) {
        float distanceFromWave2 = distance(vertexUV, uWave2Position);
        float waveTime2 = uTime - uWave2StartTime;
        float waveDuration2 = 2.0;
        
        if (waveTime2 <= waveDuration2) {
          float timeAttenuation2 = 1.0 - smoothstep(0.0, waveDuration2, waveTime2);
          float waveRadius2 = waveTime2 * 0.6;
          float waveFront2 = abs(distanceFromWave2 - waveRadius2);
          float spatialAttenuation2 = 1.0 - smoothstep(0.0, 0.25, waveFront2);
          float totalAttenuation2 = spatialAttenuation2 * timeAttenuation2;
          float wavePhase2 = (distanceFromWave2 - waveRadius2) * 8.0;
          totalWave += sin(wavePhase2) * 0.3 * totalAttenuation2;
        }
      }
      
      // Wave 3
      if (uWave3Active > 0.5) {
        float distanceFromWave3 = distance(vertexUV, uWave3Position);
        float waveTime3 = uTime - uWave3StartTime;
        float waveDuration3 = 2.0;
        
        if (waveTime3 <= waveDuration3) {
          float timeAttenuation3 = 1.0 - smoothstep(0.0, waveDuration3, waveTime3);
          float waveRadius3 = waveTime3 * 0.6;
          float waveFront3 = abs(distanceFromWave3 - waveRadius3);
          float spatialAttenuation3 = 1.0 - smoothstep(0.0, 0.25, waveFront3);
          float totalAttenuation3 = spatialAttenuation3 * timeAttenuation3;
          float wavePhase3 = (distanceFromWave3 - waveRadius3) * 8.0;
          totalWave += sin(wavePhase3) * 0.3 * totalAttenuation3;
        }
      }
      
      // Z軸方向に変位を適用（すべての波の合成）
      pos.z += totalWave;

      // より詳細な法線計算（波の勾配を考慮）- パフォーマンス最適化
      float delta = 0.08;
      
      // 近隣の波の高さを計算してより正確な法線を求める（簡略化）
      float waveLeft = 0.0;
      float waveRight = 0.0;
      float waveUp = 0.0;
      float waveDown = 0.0;
      
      // アクティブな波のみで勾配を計算（最大3つ）
      if (uWave1Active > 0.5) {
        float waveTime = uTime - uWave1StartTime;
        if (waveTime <= 2.0) {
          float timeAttenuation = 1.0 - smoothstep(0.0, 2.0, waveTime);
          float waveRadius = waveTime * 0.6;
          
          float distanceLeft = distance(vec2(vertexUV.x - delta, vertexUV.y), uWave1Position);
          float spatialAttenuationLeft = 1.0 - smoothstep(0.0, 0.25, abs(distanceLeft - waveRadius));
          waveLeft += sin((distanceLeft - waveRadius) * 8.0) * 0.3 * spatialAttenuationLeft * timeAttenuation;
          
          float distanceRight = distance(vec2(vertexUV.x + delta, vertexUV.y), uWave1Position);
          float spatialAttenuationRight = 1.0 - smoothstep(0.0, 0.25, abs(distanceRight - waveRadius));
          waveRight += sin((distanceRight - waveRadius) * 8.0) * 0.3 * spatialAttenuationRight * timeAttenuation;
          
          float distanceUp = distance(vec2(vertexUV.x, vertexUV.y + delta), uWave1Position);
          float spatialAttenuationUp = 1.0 - smoothstep(0.0, 0.25, abs(distanceUp - waveRadius));
          waveUp += sin((distanceUp - waveRadius) * 8.0) * 0.3 * spatialAttenuationUp * timeAttenuation;
          
          float distanceDown = distance(vec2(vertexUV.x, vertexUV.y - delta), uWave1Position);
          float spatialAttenuationDown = 1.0 - smoothstep(0.0, 0.25, abs(distanceDown - waveRadius));
          waveDown += sin((distanceDown - waveRadius) * 8.0) * 0.3 * spatialAttenuationDown * timeAttenuation;
        }
      }
      
      if (uWave2Active > 0.5) {
        float waveTime = uTime - uWave2StartTime;
        if (waveTime <= 2.0) {
          float timeAttenuation = 1.0 - smoothstep(0.0, 2.0, waveTime);
          float waveRadius = waveTime * 0.6;
          
          float distanceLeft = distance(vec2(vertexUV.x - delta, vertexUV.y), uWave2Position);
          waveLeft += sin((distanceLeft - waveRadius) * 8.0) * 0.3 * (1.0 - smoothstep(0.0, 0.25, abs(distanceLeft - waveRadius))) * timeAttenuation;
          
          float distanceRight = distance(vec2(vertexUV.x + delta, vertexUV.y), uWave2Position);
          waveRight += sin((distanceRight - waveRadius) * 8.0) * 0.3 * (1.0 - smoothstep(0.0, 0.25, abs(distanceRight - waveRadius))) * timeAttenuation;
          
          float distanceUp = distance(vec2(vertexUV.x, vertexUV.y + delta), uWave2Position);
          waveUp += sin((distanceUp - waveRadius) * 8.0) * 0.3 * (1.0 - smoothstep(0.0, 0.25, abs(distanceUp - waveRadius))) * timeAttenuation;
          
          float distanceDown = distance(vec2(vertexUV.x, vertexUV.y - delta), uWave2Position);
          waveDown += sin((distanceDown - waveRadius) * 8.0) * 0.3 * (1.0 - smoothstep(0.0, 0.25, abs(distanceDown - waveRadius))) * timeAttenuation;
        }
      }
      
      if (uWave3Active > 0.5) {
        float waveTime = uTime - uWave3StartTime;
        if (waveTime <= 2.0) {
          float timeAttenuation = 1.0 - smoothstep(0.0, 2.0, waveTime);
          float waveRadius = waveTime * 0.6;
          
          float distanceLeft = distance(vec2(vertexUV.x - delta, vertexUV.y), uWave3Position);
          waveLeft += sin((distanceLeft - waveRadius) * 8.0) * 0.3 * (1.0 - smoothstep(0.0, 0.25, abs(distanceLeft - waveRadius))) * timeAttenuation;
          
          float distanceRight = distance(vec2(vertexUV.x + delta, vertexUV.y), uWave3Position);
          waveRight += sin((distanceRight - waveRadius) * 8.0) * 0.3 * (1.0 - smoothstep(0.0, 0.25, abs(distanceRight - waveRadius))) * timeAttenuation;
          
          float distanceUp = distance(vec2(vertexUV.x, vertexUV.y + delta), uWave3Position);
          waveUp += sin((distanceUp - waveRadius) * 8.0) * 0.3 * (1.0 - smoothstep(0.0, 0.25, abs(distanceUp - waveRadius))) * timeAttenuation;
          
          float distanceDown = distance(vec2(vertexUV.x, vertexUV.y - delta), uWave3Position);
          waveDown += sin((distanceDown - waveRadius) * 8.0) * 0.3 * (1.0 - smoothstep(0.0, 0.25, abs(distanceDown - waveRadius))) * timeAttenuation;
        }
      }
      
      // 勾配から法線ベクトルを計算
      vec3 tangentX = normalize(vec3(2.0 * delta, 0.0, waveRight - waveLeft));
      vec3 tangentY = normalize(vec3(0.0, 2.0 * delta, waveUp - waveDown));
      vNormal = normalize(cross(tangentX, tangentY));

      // 計算後の頂点位置を適用
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `

  // フラグメントシェーダー (GLSL)
  // 各ピクセルの色を計算します。
  const fragmentShader = `
    uniform sampler2D uTexture;
    uniform float uTime;
    
    // 頂点シェーダーから受け取った変数
    varying vec2 vUv;
    varying vec3 vNormal;

    void main() {
      // テクスチャから基本色を取得
      vec4 textureColor = texture2D(uTexture, vUv);
      
      // 詳細なライティング計算
      vec3 lightDirection = normalize(vec3(2.0, 3.0, 5.0));
      vec3 viewDirection = normalize(vec3(0.0, 0.0, 1.0));
      vec3 normal = normalize(vNormal);
      
      // アンビエント（環境光）
      vec3 ambientColor = vec3(0.4, 0.45, 0.5);
      vec3 ambient = ambientColor * 0.6;
      
      // ディフューズ（拡散反射）
      float NdotL = max(dot(normal, lightDirection), 0.0);
      vec3 lightColor = vec3(1.0, 0.96, 0.8);
      vec3 diffuse = lightColor * NdotL * 0.8;
      
      // スペキュラー（鏡面反射）- 水面のような光沢効果
      vec3 reflectDir = reflect(-lightDirection, normal);
      float spec = pow(max(dot(viewDirection, reflectDir), 0.0), 32.0);
      vec3 specular = lightColor * spec * 0.3;
      
      // フレネル効果（角度による反射の変化）
      float fresnel = pow(1.0 - max(dot(normal, viewDirection), 0.0), 2.0);
      vec3 fresnelColor = vec3(0.8, 0.9, 1.0) * fresnel * 0.2;
      
      // 波による動的な光の屈折効果
      float wave = sin(vUv.x * 10.0 + uTime * 2.0) * 0.05 + sin(vUv.y * 8.0 + uTime * 1.5) * 0.03;
      vec3 waveColor = vec3(0.9, 0.95, 1.0) * wave * NdotL;
      
      // 影の計算（法線の向きに基づく）
      float shadow = smoothstep(-0.3, 0.3, dot(normal, vec3(0.0, 0.0, 1.0)));
      
      // 最終的な色を計算
      vec3 finalColor = textureColor.rgb * (ambient + diffuse * shadow) + specular + fresnelColor + waveColor;
      
      // コントラストと彩度を調整
      finalColor = mix(vec3(dot(finalColor, vec3(0.299, 0.587, 0.114))), finalColor, 1.1);
      finalColor = pow(finalColor, vec3(0.9));
      
      gl_FragColor = vec4(finalColor, textureColor.a);
    }
  `
  
  // コンポーネントがマウントされた時に一度だけ実行
  onMount(() => {
    // 画像をテクスチャとして読み込む
    const textureLoader = new TextureLoader()
    texture = textureLoader.load(imageUrl)
    
    // シェーダーマテリアルを作成
    material = new ShaderMaterial({
      uniforms: uniforms,
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      side: DoubleSide, // 裏面も表示する
    })

    // uniformにテクスチャをセット
    material.uniforms.uTexture.value = texture
  })

  // 波を追加する関数
  function addWave(position: Vector2, currentTime: number) {
    const wave = {
      position: position.clone(),
      startTime: currentTime,
      active: true
    }
    
    // 新しい波を配列に追加（古い波を削除）
    waves.push(wave)
    if (waves.length > maxWaves) {
      waves.shift() // 最古の波を削除
    }
  }

  // 毎フレーム実行されるタスクを登録
  useTask((delta: number) => {
    if (material) {
      // 経過時間をシェーダーのuTimeに渡す
      material.uniforms.uTime.value += delta
      
      // マウスホバー効果のスムーズな遷移（波には影響しない）
      const targetHover = isMouseOver ? 1.0 : 0.0
      const currentHover = material.uniforms.uMouseHover.value
      const hoverSpeed = 0.15
      
      if (Math.abs(targetHover - currentHover) > 0.01) {
        material.uniforms.uMouseHover.value += (targetHover - currentHover) * hoverSpeed
      } else {
        material.uniforms.uMouseHover.value = targetHover
      }
      
      // マウス位置をユニフォームに設定
      material.uniforms.uMousePosition.value.copy(mousePosition)
      
      // 古い波を削除（最適化：必要な時のみ実行）
      const currentTime = material.uniforms.uTime.value
      if (waves.length > 0) {
        const initialLength = waves.length
        waves = waves.filter(wave => {
          const elapsed = currentTime - wave.startTime
          return elapsed <= 2.0 && wave.active
        })
      }
      
      // 波の状態をユニフォームに設定（最大3つに最適化）
      const waveUniforms = [
        { start: 'uWave1StartTime', pos: 'uWave1Position', active: 'uWave1Active' },
        { start: 'uWave2StartTime', pos: 'uWave2Position', active: 'uWave2Active' },
        { start: 'uWave3StartTime', pos: 'uWave3Position', active: 'uWave3Active' }
      ]
      
      for (let i = 0; i < waveUniforms.length; i++) {
        if (i < waves.length && waves[i].active) {
          material.uniforms[waveUniforms[i].start].value = waves[i].startTime
          material.uniforms[waveUniforms[i].pos].value.copy(waves[i].position)
          material.uniforms[waveUniforms[i].active].value = 1.0
        } else {
          material.uniforms[waveUniforms[i].start].value = -10.0
          material.uniforms[waveUniforms[i].pos].value.set(0, 0)
          material.uniforms[waveUniforms[i].active].value = 0.0
        }
      }
    }
  })
</script>

<!-- 旗のメッシュ（Floatで常に揺れる動きを追加） -->
{#if material}
  <Float
    speed={floatSpeed}
    rotationIntensity={rotationIntensity}
    floatIntensity={0.6}
    floatingRange={floatingRange}
  >
    <!-- 
      T.Meshにイベントハンドラを追加 
      on:pointerenter: マウスカーソルがオブジェクトに乗った時に発火
      on:pointerleave: マウスカーソルがオブジェクトから離れた時に発火
    -->
    <T.Mesh 
      bind:ref={meshRef}
      {material} 
      position={position}
      rotation={[0, 0, 0]}
    onpointermove={(e: any) => {
      if (isMouseOver && e.intersections && e.intersections.length > 0) {
        // 交差点のUV座標を取得
        const intersection = e.intersections[0]
        if (intersection.uv) {
          const newMousePos = new Vector2(intersection.uv.x, intersection.uv.y)
          
          // マウスが移動した距離を計算
          const movementDistance = newMousePos.distanceTo(lastMousePosition)
          
          // 一定距離以上移動した場合のみ波を発生（パフォーマンス重視で閾値を上げる）
          if (movementDistance > 0.08) { // 閾値: 8% の移動
            mousePosition.copy(newMousePos)
            lastMousePosition.copy(newMousePos)
            
            // 波を発生させる
            if (material) {
              addWave(newMousePos, material.uniforms.uTime.value)
            }
          }
        }
      }
    }}
    onpointerover={(e: any) => {
      isMouseOver = true
      // 初期マウス位置を設定
      if (e.intersections && e.intersections.length > 0) {
        const intersection = e.intersections[0]
        if (intersection.uv) {
          mousePosition.set(intersection.uv.x, intersection.uv.y)
          lastMousePosition.set(intersection.uv.x, intersection.uv.y)
          
          // ホバー開始時にも波を発生
          if (material) {
            addWave(new Vector2(intersection.uv.x, intersection.uv.y), material.uniforms.uTime.value)
          }
        }
      }
    }}
    onpointerleave={(e: any) => {
      isMouseOver = false
      // 波は停止させない - 自然に減衰するまで継続
    }}
    >
      <!-- 
        平面ジオメトリを作成
        引数: [幅, 高さ, 横の分割数, 縦の分割数]
      -->
      <T.PlaneGeometry args={[clothSize.width, clothSize.height, clothSegments.width, clothSegments.height]} />
    </T.Mesh>
  </Float>
{/if}