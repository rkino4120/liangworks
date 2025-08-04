<script lang="ts">
  // --- Threlte/Three.js モジュールのインポート ---
  import { T, useTask } from '@threlte/core';
  import * as THREE from 'three';
  import { onMount, onDestroy } from 'svelte';

  // --- Props (コンポーネント設定) ---
  // 親コンポーネントからアニメーションのパラメータを調整できるようにします
  export let pointCount = 5000; // 中心のオブジェクトを構成する点の数
  export let radius = 4.5; // オブジェクトの基本半径
  export let color = "#00d0ff"; // パーティクルの色
  export let surroundingPointCount = 2000; // 周囲に漂う点の数

  // =================================================================
  // シェーダーコード
  // GPU上で各パーティクルの計算を高速に行います
  // =================================================================

  // --- 頂点シェーダー (メインオブジェクト用) ---
  // 各点の「位置」と「サイズ」を計算します
  const vertexShader = `
    // --- Uniforms (外部から渡す共通データ) ---
    uniform float uTime;          // 時間 (アニメーション用)
    uniform float uPointSize;     // 基本の点サイズ
    uniform float uScatter;       // 拡散の度合い (0: 形状, 1: 拡散)
    uniform float wSphere;        // 球体の重み
    uniform float wCube;          // 立方体の重み
    uniform float wTorus;         // トーラスの重み
    uniform vec2 uMouse;          // マウスカーソルの位置

    // --- Attributes (各点に固有のデータ) ---
    attribute vec3 aCubePosition;    // 立方体形状での位置
    attribute vec3 aTorusPosition;   // トーラス形状での位置
    attribute vec3 aScatterPosition; // 拡散時の目標位置

    // --- 定数・ヘルパー関数 ---
    #define PI 3.141592653589793
    
    // 線形補間: 2つのベクトル間を滑らかに移動します
    vec3 lerp(vec3 a, vec3 b, float t) {
      return a * (1.0 - t) + b * t;
    }

    // Y軸回転行列
    mat4 rotationY(float angle) {
      return mat4(
        cos(angle), 0.0, sin(angle), 0.0,
        0.0, 1.0, 0.0, 0.0,
        -sin(angle), 0.0, cos(angle), 0.0,
        0.0, 0.0, 0.0, 1.0
      );
    }
    // X軸回転行列
    mat4 rotationX(float angle) {
      return mat4(
        1.0, 0.0, 0.0, 0.0,
        0.0, cos(angle), -sin(angle), 0.0,
        0.0, sin(angle), cos(angle), 0.0,
        0.0, 0.0, 0.0, 1.0
      );
    }

    // --- メイン処理 ---
    void main() {
      // 1. 形状のモーフィング
      //    各形状の重み(wSphere, wCube, wTorus)に基づいて、点の基本位置を計算します。
      //    'position' は球体の位置です。
      vec3 shapePosition = position * wSphere + aCubePosition * wCube + aTorusPosition * wTorus;

      // 2. 拡散状態への移行
      //    モーフィングされた形状の位置と、ランダムな拡散位置との間を補間します。
      vec3 finalPosition = lerp(shapePosition, aScatterPosition, uScatter);

      // 3. 回転の適用
      //    時間経過による自動回転と、マウス操作による回転を合成します。
      mat4 autoRotation = rotationY(uTime * 0.1) * rotationX(uTime * 0.05);
      mat4 mouseRotation = rotationY(uMouse.x * 0.15);
      vec4 modelPosition = autoRotation * mouseRotation * vec4(finalPosition, 1.0);
      
      // 4. 最終的な座標とサイズを決定
      //    カメラから見た座標 (viewPosition) を計算し、最終的な出力座標 (gl_Position) を設定します。
      vec4 viewPosition = viewMatrix * modelPosition;
      gl_Position = projectionMatrix * viewPosition;

      //    カメラからの距離に応じて点のサイズを調整し、遠近感を表現します。
      gl_PointSize = uPointSize * (15.0 / -viewPosition.z);
    }
  `;
  
  // --- フラグメントシェーダー (共通) ---
  // 各点の「色」と「透明度」を計算します
  const fragmentShader = `
    uniform vec3 uColor;   // 点の色
    uniform float uOpacity; // 点の不透明度

    void main() {
      // 点の中心からの距離を計算し、円形にします
      float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
      // 縁が硬くなりすぎないように、少し内側で描画を打ち切ります
      if (distanceToCenter > 0.45) {
        discard; // このピクセルを描画しない
      }
      // 最終的な色と透明度を設定
      gl_FragColor = vec4(uColor, uOpacity);
    }
  `;

  // --- 頂点シェーダー (周囲の点用) ---
  // パーリンノイズを使って、宇宙の塵のように揺らめく動きを表現します
  const surroundingVertexShader = `
    uniform float uTime;
    uniform float uPointSize;
    uniform vec2 uMouse;

    // 3D Simplex Noise (by Patriciogonzalezvivo)
    // https://gist.github.com/patriciogonzalezvivo/670c22f3966e662d2f83
    // (ノイズ関数のコードは省略)
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
    float snoise(vec3 v) { const vec2 C = vec2(1.0/6.0, 1.0/3.0) ; const vec4 D = vec4(0.0, 0.5, 1.0, 2.0); vec3 i  = floor(v + dot(v, C.yyy) ); vec3 x0 = v - i + dot(i, C.xxx) ; vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1.0 - g; vec3 i1 = min( g.xyz, l.zxy ); vec3 i2 = max( g.xyz, l.zxy ); vec3 x1 = x0 - i1 + C.xxx; vec3 x2 = x0 - i2 + C.yyy; vec3 x3 = x0 - D.yyy; i = mod289(i); vec4 p = permute( permute( permute( i.z + vec4(0.0, i1.z, i2.z, 1.0 )) + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) + i.x + vec4(0.0, i1.x, i2.x, 1.0 )); float n_ = 0.142857142857; vec3  ns = n_ * D.wyz - D.xzx; vec4 j = p - 49.0 * floor(p * ns.z * ns.z); vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7.0 * x_ ); vec4 x = x_ *ns.x + ns.yyyy; vec4 y = y_ *ns.x + ns.yyyy; vec4 h = 1.0 - abs(x) - abs(y); vec4 b0 = vec4( x.xy, y.xy ); vec4 b1 = vec4( x.zw, y.zw ); vec4 s0 = floor(b0)*2.0 + 1.0; vec4 s1 = floor(b1)*2.0 + 1.0; vec4 sh = -step(h, vec4(0.0)); vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ; vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ; vec3 p0 = vec3(a0.xy,h.x); vec3 p1 = vec3(a0.zw,h.y); vec3 p2 = vec3(a1.xy,h.z); vec3 p3 = vec3(a1.zw,h.w); vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3))); p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w; vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0); m = m * m; return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) ); }

    // Y軸回転行列
    mat4 rotationY(float angle) {
      return mat4(
        cos(angle), 0.0, sin(angle), 0.0,
        0.0, 1.0, 0.0, 0.0,
        -sin(angle), 0.0, cos(angle), 0.0,
        0.0, 0.0, 0.0, 1.0
      );
    }

    void main() {
      float noiseAmplitude = 0.15; // ノイズによる揺れの強さ
      // 時間と位置に基づいてノイズを生成し、揺らぎを加える
      vec3 noise = vec3(
        snoise(position * 0.5 + uTime * 0.5),
        snoise(position * 0.5 + uTime * 0.5 + 100.0),
        snoise(position * 0.5 + uTime * 0.5 + 200.0)
      );
      vec3 displacedPosition = position + noise * noiseAmplitude;

      // マウス操作で回転させる
      mat4 mouseRotation = rotationY(uMouse.x * 0.8);
      vec4 modelPosition = mouseRotation * vec4(displacedPosition, 1.0);

      // 最終的な座標とサイズを計算
      vec4 viewPosition = viewMatrix * modelPosition;
      gl_Position = projectionMatrix * viewPosition;
      gl_PointSize = uPointSize * (20.0 / -viewPosition.z);
    }
  `;

  // --- シェーダーに渡す Uniforms の初期化 ---
  const uniforms = {
    uTime: { value: 0 },
    uPointSize: { value: 4.0 },
    uColor: { value: new THREE.Color(color) },
    uOpacity: { value: 0.85 },
    uMouse: { value: new THREE.Vector2() },
    wSphere: { value: 1.0 }, // 初期形状は球
    wCube: { value: 0.0 },
    wTorus: { value: 0.0 },
    uScatter: { value: 0.0 }, // 初期は拡散しない
  };

  const surroundingUniforms = {
    uTime: { value: 0 },
    uPointSize: { value: 4.5 },
    uColor: { value: new THREE.Color(color) },
    uOpacity: { value: 0.6 },
    uMouse: { value: new THREE.Vector2() },
  };

  // =================================================================
  // ジオメトリとAttributeの生成
  // CPU側で一度だけ計算し、シェーダーに渡す準備をします
  // =================================================================

  // --- メインオブジェクトのジオメトリ ---
  const geometry = (() => {
    const geom = new THREE.BufferGeometry();
    // 各形状・状態の頂点座標を格納する配列
    const spherePos = new Float32Array(pointCount * 3);
    const cubePos = new Float32Array(pointCount * 3);
    const torusPos = new Float32Array(pointCount * 3);
    const scatterPos = new Float32Array(pointCount * 3);

    // 各形状の計算用パラメータ
    const cubeSize = radius * 1.5;
    const halfSize = cubeSize / 2;
    const scatterRange = 25;
    const torusMajorRadius = radius * 0.8; // トーラスの主半径
    const torusMinorRadius = radius * 0.4; // トーラスのパイプ半径

    // --- 各点の位置を計算 ---
    const torusPointsPerRow = Math.round(Math.sqrt(pointCount));
    for (let i = 0; i < pointCount; i++) {
      const idx = i * 3;

      // 1. 球体 (Fibonacci Sphere)
      //    ほぼ均等に点を配置できるフィボナッチ格子法を使用
      const y = 1 - (i / (pointCount - 1)) * 2;
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = Math.PI * (3 - Math.sqrt(5)) * i;
      spherePos[idx] = Math.cos(theta) * radiusAtY * radius;
      spherePos[idx + 1] = y * radius;
      spherePos[idx + 2] = Math.sin(theta) * radiusAtY * radius;
      
      // 2. トーラス
      //    UV座標を使ってトーラス表面に点を配置
      const u = (i % torusPointsPerRow) / torusPointsPerRow * Math.PI * 2;
      const v = Math.floor(i / torusPointsPerRow) / torusPointsPerRow * Math.PI * 2;
      torusPos[idx] = (torusMajorRadius + torusMinorRadius * Math.cos(v)) * Math.cos(u);
      torusPos[idx + 1] = torusMinorRadius * Math.sin(v);
      torusPos[idx + 2] = (torusMajorRadius + torusMinorRadius * Math.cos(v)) * Math.sin(u);

      // 3. 拡散状態
      //    ランダムな範囲に点を配置
      scatterPos[idx] = (Math.random() - 0.5) * scatterRange;
      scatterPos[idx + 1] = (Math.random() - 0.5) * scatterRange * 0.6;
      scatterPos[idx + 2] = (Math.random() - 0.5) * scatterRange * 1.2;
    }

    // 4. 立方体
    //    6つの面に均等に点を配置
    let pointIndex = 0;
    const pointsPerFace = Math.ceil(pointCount / 6);
    const pointsPerRow = Math.round(Math.sqrt(pointsPerFace));
    for (let face = 0; face < 6; face++) {
      for (let j = 0; j < pointsPerRow; j++) {
        for (let k = 0; k < pointsPerRow; k++) {
          if (pointIndex >= pointCount) break;
          const idx = pointIndex * 3;
          const u = (j / (pointsPerRow - 1) - 0.5) * cubeSize;
          const v = (k / (pointsPerRow - 1) - 0.5) * cubeSize;
          switch (face) {
            case 0: cubePos[idx] = u; cubePos[idx+1] = v; cubePos[idx+2] = halfSize; break; // Front
            case 1: cubePos[idx] = u; cubePos[idx+1] = v; cubePos[idx+2] = -halfSize; break; // Back
            case 2: cubePos[idx] = halfSize; cubePos[idx+1] = u; cubePos[idx+2] = v; break; // Right
            case 3: cubePos[idx] = -halfSize; cubePos[idx+1] = u; cubePos[idx+2] = v; break; // Left
            case 4: cubePos[idx] = u; cubePos[idx+1] = halfSize; cubePos[idx+2] = v; break; // Top
            case 5: cubePos[idx] = u; cubePos[idx+1] = -halfSize; cubePos[idx+2] = v; break; // Bottom
          }
          pointIndex++;
        }
        if (pointIndex >= pointCount) break;
      }
      if (pointIndex >= pointCount) break;
    }
    
    // 計算した座標をAttributeとしてジオメトリに設定
    geom.setAttribute('position', new THREE.BufferAttribute(spherePos, 3));
    geom.setAttribute('aCubePosition', new THREE.BufferAttribute(cubePos, 3));
    geom.setAttribute('aTorusPosition', new THREE.BufferAttribute(torusPos, 3));
    geom.setAttribute('aScatterPosition', new THREE.BufferAttribute(scatterPos, 3));
    
    return geom;
  })();

  // --- 周囲の点のジオメトリ ---
  const surroundingGeometry = (() => {
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(surroundingPointCount * 3);
    for (let i = 0; i < surroundingPointCount; i++) {
      const index = i * 3;
      // Z軸方向の範囲を広げ、奥行きと遠近感を強調
      positions[index] = (Math.random() - 0.5) * 30;
      positions[index + 1] = (Math.random() - 0.5) * 20;
      positions[index + 2] = (Math.random() - 0.5) * 30;
    }
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geom;
  })();

  // =================================================================
  // アニメーションとインタラクション
  // =================================================================
  const clock = new THREE.Clock();
  const transformDuration = 18; // 形状変化の1サイクルの時間（秒）

  // イージング関数 (滑らかな変化のため)
  const easeInOutCubic = (t: number): number => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  // マウス移動イベントのハンドラ
  const handleMouseMove = (event: MouseEvent) => {
    // マウス座標を -1 から 1 の範囲に正規化
    const x = (event.clientX / window.innerWidth) * 2 - 1;
    const y = -(event.clientY / window.innerHeight) * 2 + 1;
    // Uniformsに値をセット
    uniforms.uMouse.value.x = x;
    uniforms.uMouse.value.y = y;
    surroundingUniforms.uMouse.value.x = x;
    surroundingUniforms.uMouse.value.y = y;
  };

  // コンポーネントのマウント/アンマウント時にイベントリスナーを登録/解除
  onMount(() => { window.addEventListener('mousemove', handleMouseMove); });
  onDestroy(() => { window.removeEventListener('mousemove', handleMouseMove); });

  // 毎フレーム実行されるタスク (Threlteの機能)
  useTask(() => {
    const elapsedTime = clock.getElapsedTime();
    // 時間をシェーダーに渡す
    uniforms.uTime.value = elapsedTime;
    surroundingUniforms.uTime.value = elapsedTime;

    // アニメーションサイクルの進行度 (0から1) を計算
    const cycle = (elapsedTime % transformDuration) / transformDuration;

    let wSphere = 0, wCube = 0, wTorus = 0, scatter = 0;
    let progress = 0;

    // --- 形状モーフィングのロジック ---
    // cycleの値に応じて、各形状の重み(w...)と拡散度(scatter)を変化させる
    if (cycle < 0.15) { // Sphere 表示
        wSphere = 1;
    } else if (cycle < 0.20) { // Sphere -> Scatter
        progress = (cycle - 0.15) / 0.05;
        wSphere = 1;
        scatter = easeInOutCubic(progress);
    } else if (cycle < 0.25) { // Scatter -> Cube
        progress = (cycle - 0.20) / 0.05;
        wSphere = 1 - easeInOutCubic(progress);
        wCube = easeInOutCubic(progress);
        scatter = 1 - easeInOutCubic(progress);
    } else if (cycle < 0.40) { // Cube 表示
        wCube = 1;
    } else if (cycle < 0.45) { // Cube -> Scatter
        progress = (cycle - 0.40) / 0.05;
        wCube = 1;
        scatter = easeInOutCubic(progress);
    } else if (cycle < 0.50) { // Scatter -> Torus
        progress = (cycle - 0.45) / 0.05;
        wCube = 1 - easeInOutCubic(progress);
        wTorus = easeInOutCubic(progress);
        scatter = 1 - easeInOutCubic(progress);
    } else if (cycle < 0.65) { // Torus 表示
        wTorus = 1;
    } else if (cycle < 0.70) { // Torus -> Scatter
        progress = (cycle - 0.65) / 0.05;
        wTorus = 1;
        scatter = easeInOutCubic(progress);
    } else if (cycle < 0.75) { // Scatter -> Sphere
        progress = (cycle - 0.70) / 0.05;
        wTorus = 1 - easeInOutCubic(progress);
        wSphere = easeInOutCubic(progress);
        scatter = 1 - easeInOutCubic(progress);
    } else { // Sphere 表示 (サイクルの最後)
        wSphere = 1;
    }

    // 計算した値をUniformsにセットしてシェーダーに送る
    uniforms.wSphere.value = wSphere;
    uniforms.wCube.value = wCube;
    uniforms.wTorus.value = wTorus;
    uniforms.uScatter.value = scatter;
  });

</script>

<!-- ================================================================= -->
<!-- Svelteコンポーネント (シーンの構築) -->
<!-- ================================================================= -->

<!-- カメラとシーン設定 -->
<T.PerspectiveCamera makeDefault position={[0, 0, 13]} fov={75} />
<T.Fog color="#000510" near={8} far={40} />
<T.AmbientLight intensity={0.5} />

<!-- メインのパーティクルシステム -->
<T.Points {geometry}>
  <T.ShaderMaterial
    {vertexShader}
    {fragmentShader}
    {uniforms}
    transparent={true}
    blending={THREE.AdditiveBlending}
    depthWrite={false}
  />
</T.Points>

<!-- 周囲のパーティクルシステム -->
<T.Points geometry={surroundingGeometry}>
    <T.ShaderMaterial
      vertexShader={surroundingVertexShader}
      {fragmentShader}
      uniforms={surroundingUniforms}
      transparent={true}
      blending={THREE.AdditiveBlending}
      depthWrite={false}
    />
</T.Points>
