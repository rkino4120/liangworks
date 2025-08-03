import { useRef, useEffect } from 'react';
import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, DirectionalLight, ShadowGenerator, MeshBuilder, PointerEventTypes, Animation, AbstractMesh, Color3, Color4, VertexBuffer, CubicEase, EasingFunction, StandardMaterial, PBRMaterial, HDRCubeTexture } from "@babylonjs/core";
import { AdvancedDynamicTexture, TextBlock, Control } from "@babylonjs/gui";

const App = () => {
  const reactCanvas = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!reactCanvas.current) {
      console.error("キャンバス要素が見つかりませんでした。");
      return;
    }
    const engine: Engine = new Engine(reactCanvas.current, true, { preserveDrawingBuffer: true, stencil: true, antialias: true });

    const createScene = function () {
      // シーンを作成
      const scene = new Scene(engine);
      // Skyboxを削除したため、背景色を設定
      scene.clearColor = new Color4(0.2, 0.2, 0.3, 1.0);

      // FIX: シャボン玉の位置を基準にカメラのターゲットを設定
      const bubblePosition = new Vector3(0, -1, 0);
      const camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 15, bubblePosition, scene);
      camera.attachControl(reactCanvas.current, true);
      // ズーム範囲を調整
      // ズームを禁止 (カメラの半径を固定)
      camera.lowerRadiusLimit = 15;
      camera.upperRadiusLimit = 15;

      // パン操作を禁止
      camera.panningSensibility = 0;

      // 回転を+-5度に制限
      const fiveDegrees = 5 * (Math.PI / 180);
      camera.lowerAlphaLimit = camera.alpha - fiveDegrees;
      camera.upperAlphaLimit = camera.alpha + fiveDegrees;
      camera.lowerBetaLimit = camera.beta - fiveDegrees;
      // beta値が0を下回らないように制限
      if (camera.lowerBetaLimit < 0) {
        camera.lowerBetaLimit = 0.01;
      }
      camera.upperBetaLimit = camera.beta + fiveDegrees;
      // beta値がPIを上回らないように制限
      if (camera.upperBetaLimit > Math.PI) {
        camera.upperBetaLimit = Math.PI - 0.01;
      }

      const ambientLight = new HemisphericLight("ambientLight", new Vector3(0, 1, 0), scene);
      ambientLight.intensity = 0.5;

      // ライトを追加 (環境光がなくなったため少し強くする)
      const directionalLight = new DirectionalLight("dirLight", new Vector3(-1, -2, -1), scene);
      directionalLight.position = new Vector3(20, 40, 20);
      directionalLight.intensity = 0.5;

      // シャドウマップを生成
      const shadowGenerator = new ShadowGenerator(1024, directionalLight);
      shadowGenerator.useBlurExponentialShadowMap = true;
      shadowGenerator.blurKernel = 32;

      const hdrTexture = new HDRCubeTexture("/images/pond_bridge_night_1k.hdr", scene, 512);
      scene.createDefaultSkybox(hdrTexture, true, 1000);

      // FIX: 地面を再追加
      const ground = MeshBuilder.CreateGround("ground", {width: 20, height: 20}, scene);
      // FIX: 地面を透明にし、色の指定を削除
      const groundMaterial = new StandardMaterial("groundMaterial", scene);
      groundMaterial.alpha = 0.0; // 透明度を設定 (0.0が完全透明, 1.0が不透明)
      ground.material = groundMaterial;
      ground.position.y = -2;
      ground.receiveShadows = true;

      // --- 複数のシャボン玉を生成 ---
      const bubbleCount = 5;
      const bubbles: AbstractMesh[] = [];
      const bubbleMaterial = new PBRMaterial("bubbleMaterial", scene);
      bubbleMaterial.reflectionTexture = hdrTexture;
      bubbleMaterial.refractionTexture = hdrTexture;
      bubbleMaterial.indexOfRefraction = 1.05;
      bubbleMaterial.metallic = 0.8;
      bubbleMaterial.roughness = 0.2;
      bubbleMaterial.alpha = 0.6;
      bubbleMaterial.albedoColor = new Color3(0.5, 0.8, 1.0);
      bubbleMaterial.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
      bubbleMaterial.backFaceCulling = false;

      const topY = 10;
      const horizontalRange = 8;

      for (let i = 0; i < bubbleCount; i++) {
        // FIX: シャボン玉の大きさをランダム化
        const diameter = Math.random() * 1.5 + 1.0; // 1.0から2.5の間の大きさ
        const bubble = MeshBuilder.CreateSphere(`bubble_${i}`, { diameter, segments: 32, updatable: true }, scene);
        bubble.material = bubbleMaterial;
        bubble.position = new Vector3(
          (Math.random() - 0.5) * horizontalRange, 
          topY * Math.random(), // 開始高さをランダムに
          (Math.random() - 0.5) * horizontalRange
        );
        bubble.metadata = { 
          isDeforming: false,
          velocity: new Vector3(0, -0.01, 0)
        };
        const shadowMap = shadowGenerator.getShadowMap();
        if (shadowMap && shadowMap.renderList) {
          shadowMap.renderList.push(bubble);
        }
        bubbles.push(bubble);
      }
      
      // テキスト表示
      const adt = AdvancedDynamicTexture.CreateFullscreenUI("UI");
      const textBlock = new TextBlock();
      textBlock.text = "Tap the bubbles";
      textBlock.color = "black";
      textBlock.fontSize = 24;
      textBlock.fontFamily = "sans-serif";
      textBlock.alpha = 1.0;
      textBlock.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
      textBlock.paddingBottom = "20px";
      adt.addControl(textBlock);

      // --- アニメーション設定 ---
      const bottomY = -1.0;
      const gravity = -0.0005;
      const damping = 0.98;
      // FIX: 風の方向をランダム化
      const wind = new Vector3(
        (Math.random() - 0.5) * 0.001, // X方向の風
        0, 
        (Math.random() - 0.5) * 0.001  // Z方向の風
      );
      let time = 0;
      
      // クリックイベントの処理
      scene.onPointerObservable.add((pointerInfo) => {
          switch (pointerInfo.type) {
            case PointerEventTypes.POINTERDOWN:
              const pickResult = scene.pick(scene.pointerX, scene.pointerY);
              // クリックされたのがいずれかのシャボン玉かチェック
              if (pickResult.hit && bubbles.includes(pickResult.pickedMesh as AbstractMesh) && pickResult.pickedPoint) {
                  const pickedBubble = pickResult.pickedMesh as AbstractMesh;
                  const hitNormal = pickResult.getNormal(true);
                  if (hitNormal) {
                      const invWorldMatrix = pickedBubble.getWorldMatrix().invert();
                      const localPickedPoint = Vector3.TransformCoordinates(pickResult.pickedPoint, invWorldMatrix);
                      const localNormal = Vector3.TransformNormal(hitNormal, invWorldMatrix);
                      applyImpulseAndDeform(pickedBubble, localPickedPoint, localNormal);
                  }
              }
            break;
          }
      });

      // 物理演算と再生成のループ
      scene.onBeforeRenderObservable.add(() => {
        time += 0.01;
        const windFluctuation = (Math.sin(time) * 0.5 + 0.5) + 0.2;
        const currentWind = wind.scale(windFluctuation);

        // すべてのシャボン玉をループ
        for (const bubble of bubbles) {
            // 速度に力を加算（重力と風）
            bubble.metadata.velocity.y += gravity;
            bubble.metadata.velocity.addInPlace(currentWind);

            // 速度を減衰させる
            bubble.metadata.velocity.scaleInPlace(damping);
            // 速度に基づいて位置を更新
            bubble.position.addInPlace(bubble.metadata.velocity);

            // 地面に到達したらリセット
            if (bubble.position.y < bottomY && !bubble.metadata.isDeforming) {
                bubble.position.y = topY;
                bubble.position.x = (Math.random() - 0.5) * horizontalRange;
                bubble.position.z = (Math.random() - 0.5) * horizontalRange;
                // 速度もリセット
                bubble.metadata.velocity.set(0, -0.01, 0);
            }
        }
      });
      
      // クリック時の力積と変形アニメーション関数
      const applyImpulseAndDeform = (mesh: AbstractMesh, contactPoint: Vector3, hitNormal: Vector3) => {
          if (mesh.metadata && mesh.metadata.isDeforming) {
              return;
          }
          mesh.metadata.isDeforming = true;
          mesh.metadata.progress = 0;

          const pushDirection = hitNormal.scale(-1);
          const pushStrength = 0.15;
          mesh.metadata.velocity.addInPlace(pushDirection.scale(pushStrength));

          const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
          if (!positions) return;
          const normals = mesh.getVerticesData(VertexBuffer.NormalKind);
          if (!normals) return;
          
          const originalPositions = new Float32Array(positions);

          const frameRate = 60;
          const totalAnimationTime = 1.5;
          const myEasing = new CubicEase();
          myEasing.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);

          const progressAnimation = new Animation("progressAnim", "metadata.progress", frameRate, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT);
          const progressKeys = [];
          progressKeys.push({ frame: 0, value: 0 });
          progressKeys.push({ frame: frameRate * 0.2, value: 1 });
          progressKeys.push({ frame: frameRate * totalAnimationTime, value: 0 });
          progressAnimation.setKeys(progressKeys);
          progressAnimation.setEasingFunction(myEasing);
          
          const beforeRenderObserver = scene.onBeforeRenderObservable.add(() => {
              if (!mesh.metadata) return;
              const progress = mesh.metadata.progress;
              const bounceProgress = Math.sin(progress * Math.PI);

              const bounceScaleDown = 1.0 - 0.2 * bounceProgress;
              const bounceScaleUp = 1.0 + 0.1 * bounceProgress;

              const currentPositions = new Float32Array(originalPositions.length);
              const radiusOfEffect = 0.8;
              const maxIndentation = 0.4;

              for (let i = 0; i < originalPositions.length / 3; i++) {
                  const vertex = new Vector3(originalPositions[i * 3], originalPositions[i * 3 + 1], originalPositions[i * 3 + 2]);
                  
                  const proj = Vector3.Dot(vertex, hitNormal);
                  const vecNormal = hitNormal.scale(proj);
                  const vecPerp = vertex.subtract(vecNormal);
                  const bouncedVertex = vecNormal.scale(bounceScaleDown).add(vecPerp.scale(bounceScaleUp));
                  
                  let finalPosition = bouncedVertex;
                  const distance = Vector3.Distance(vertex, contactPoint);
                  if (distance < radiusOfEffect) {
                      const normalForDent = new Vector3(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]);
                      const falloff = 1 - (distance / radiusOfEffect);
                      const indentation = falloff * maxIndentation * progress;
                      finalPosition = bouncedVertex.add(normalForDent.scale(-indentation));
                  }

                  currentPositions[i * 3]     = finalPosition.x;
                  currentPositions[i * 3 + 1] = finalPosition.y;
                  currentPositions[i * 3 + 2] = finalPosition.z;
              }
              mesh.updateVerticesData(VertexBuffer.PositionKind, currentPositions, false, false);
          });
          
          scene.beginDirectAnimation(mesh, [progressAnimation], 0, frameRate * totalAnimationTime, false, undefined, () => {
              scene.onBeforeRenderObservable.remove(beforeRenderObserver);
              mesh.metadata.isDeforming = false;
              mesh.updateVerticesData(VertexBuffer.PositionKind, originalPositions, false, false);
          });
      };

      return scene;
    }
    const scene = createScene();

    // レンダリングループを開始
    engine.runRenderLoop(() => {
      scene.render();
    });

    // ウィンドウのリサイズイベントを処理
    const handleResize = () => {
      engine.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      engine.dispose();
      scene.dispose();
    };
  }, []);

  return (
    <>
        <div className="relative w-screen h-screen">
            <canvas ref={reactCanvas} className="absolute top-0 left-0 w-full h-full z-0 focus:outline-none"></canvas>
        </div>
    </>
  )
}

export default App
