<!-- /src/lib/components/ScrollAction.svelte -->
<script lang="ts">
    import { T, useTask, useThrelte } from '@threlte/core';
    import { useGltf, Text, useDraco } from '@threlte/extras';
    import { Vector3, Box3 } from 'three';

    // ==================================================================
    // 0. プロパティの受け取り
    // ==================================================================
    export let scrollPercent: number = 0;

    // ==================================================================
    // 1. 3Dモデルの読み込みと初期化
    // ==================================================================
    const dracoLoader = useDraco();
    const gltf = useGltf('/glb/test_character.glb', {
        dracoLoader
    });

    // モデルの初期化が完了したかを管理するフラグ
    let isInitialized = false;

    // モデルが読み込まれたら、サイズと位置を「一度だけ」調整します。
    $: if ($gltf?.scene && !isInitialized) {
        const box = new Box3().setFromObject($gltf.scene);
        const center = box.getCenter(new Vector3());
        const size = box.getSize(new Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        // スケール値を5から10に変更して、モデルを約2倍の大きさにします。
        const scale = 10 / maxDim;

        $gltf.scene.scale.setScalar(scale);
        $gltf.scene.position.sub(center.multiplyScalar(scale));

        // 初期化が完了したことを記録
        isInitialized = true;
    }

    // ==================================================================
    // 2. カメラアニメーション
    // ==================================================================
    // アニメーションの各キーフレームとなるカメラの位置と注視点を定義
    const cameraPos1 = new Vector3(0, 4, 12); // 初期位置
    const cameraTarget1 = new Vector3(0, 2, 0); // 初期注視点

    // ===== 修正点 =====
    // ご要望に応じて、カメラの左右への移動量を増やしました。

    // 33%～66%: さらに左へ移動し、ズーム
    const cameraPos2 = new Vector3(-15, 4, 9); // Xを-8から-15に変更
    const cameraTarget2 = new Vector3(-8, 2, 0); // Xを-3から-8に変更

    // 66%～100%: さらに右へ移動
    const cameraPos3 = new Vector3(15, 4, 12); // Xを8から15に変更
    const cameraTarget3 = new Vector3(8, 2, 0); // Xを3から8に変更

    const { camera } = useThrelte();

    // スクロール率に応じてカメラ位置と注視点を更新します。
    useTask(() => {
        if (!$camera) return;

        // イージング関数（easeOutQuad）
        function easeOutQuad(t: number) {
            return t * (2 - t);
        }

        const currentTargetPos = new Vector3();
        const currentLookAt = new Vector3();

        let localPercent = 0;
        if (scrollPercent < 0.33) {
            localPercent = scrollPercent / 0.33;
            localPercent = easeOutQuad(localPercent);
            // 初期位置で少しだけ動くように lerp を使用
            currentTargetPos.lerpVectors(cameraPos1, cameraPos1, localPercent);
            currentLookAt.lerpVectors(cameraTarget1, cameraTarget1, localPercent);
        } else if (scrollPercent < 0.66) {
            localPercent = (scrollPercent - 0.33) / 0.33;
            localPercent = easeOutQuad(localPercent);
            currentTargetPos.lerpVectors(cameraPos1, cameraPos2, localPercent);
            currentLookAt.lerpVectors(cameraTarget1, cameraTarget2, localPercent);
        } else {
            localPercent = (scrollPercent - 0.66) / 0.34;
            localPercent = easeOutQuad(localPercent);
            currentTargetPos.lerpVectors(cameraPos2, cameraPos3, localPercent);
            currentLookAt.lerpVectors(cameraTarget2, cameraTarget3, localPercent);
        }

        // 補間係数を小さくして、よりゆっくりカメラが追従するように
        $camera.position.lerp(currentTargetPos, 0.025);
        $camera.lookAt(currentLookAt);
    });

    // ==================================================================
    // 3. モデルの回転アニメーション
    // ==================================================================
    useTask((delta) => {
        // モデルが初期化された後でのみ回転させます。
        if ($gltf?.scene && isInitialized) {
            $gltf.scene.rotation.y += delta * 0.2;
        }
    });
</script>

<!-- このコンポーネントはCanvasの子として使われるため、<Canvas>タグは含みません -->

<T.PerspectiveCamera makeDefault position={cameraPos1.toArray()} fov={75} />

<T.AmbientLight intensity={1.5} />
<T.DirectionalLight intensity={3.5} position={[5, 10, 8]} />

{#await $gltf then gltfData}
    {#if gltfData?.scene}
        <T is={gltfData.scene} />
    {/if}
{:catch error}
    <Text position.y={1} text={'Error: ' + error.message} color="red" anchorX="center" />
{/await}

{#if !$gltf}
    <T.Mesh position.y={1}>
        <T.BoxGeometry />
        <T.MeshStandardMaterial color="orange" wireframe />
        <Text position.y={1.5} text="Loading..." anchorX="center" anchorY="middle" />
    </T.Mesh>
{/if}
