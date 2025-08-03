import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Engine as BabylonEngine, Scene as BabylonScene, useScene } from 'react-babylonjs';
import {
    Color3,
    Vector3,
    SpotLight,
    Color4,
    ShadowGenerator,
    Mesh,
    Scene,
    Texture,
    ActionManager,
    ExecuteCodeAction,
    Animation,
    CubicEase,
    EasingFunction,
    TransformNode,
} from '@babylonjs/core';
import * as Tone from 'tone';

// Constants
const GALLERY_RADIUS = 0.75;
const PANEL_WIDTH = 0.5;
const GROUND_SIZE = 10;
const SHADOW_MAP_SIZE = 1024;
const PHOTOS_PER_PAGE = 8;
const ANIMATION_DURATION_FRAMES = 60;
const ANIMATION_Y_OFFSET = 0.5;
const CAMERA_POSITION = new Vector3(0, 1.6, 0);
const AUDIO_BUTTON_POSITION = new Vector3(0, 1.5, -1);
const PAGE_NAV_POSITION = new Vector3(0, 1.2, -1);
const GROUND_COLOR = new Color3(0.2, 0.2, 0.3);
const CLEAR_COLOR = new Color4(0.05, 0.05, 0.1, 1);

// Animation easing
const EASE_IN_CUBIC = (() => {
    const ease = new CubicEase();
    ease.setEasingMode(EasingFunction.EASINGMODE_EASEIN);
    return ease;
})();

const EASE_OUT_CUBIC = (() => {
    const ease = new CubicEase();
    ease.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);
    return ease;
})();


// Default gallery data as fallback
const DEFAULT_GALLERY_DATA: GalleryDataItem[] = [
    { "imageUrl": "/images/photo01.jpg", "title": "作品 01" },
    { "imageUrl": "/images/photo02.jpg", "title": "作品 02" },
    { "imageUrl": "/images/photo03.jpg", "title": "作品 03" },
    { "imageUrl": "/images/photo04.jpg", "title": "作品 04" },
    { "imageUrl": "/images/photo05.jpg", "title": "作品 05" },
    { "imageUrl": "/images/photo06.jpg", "title": "作品 06" },
    { "imageUrl": "/images/photo07.jpg", "title": "作品 07" },
    { "imageUrl": "/images/photo08.jpg", "title": "作品 08" },
    { "imageUrl": "/images/photo09.jpg", "title": "作品 09" },
    { "imageUrl": "/images/photo10.jpg", "title": "作品 10" },
    { "imageUrl": "/images/photo11.jpg", "title": "作品 11" },
    { "imageUrl": "/images/photo12.jpg", "title": "作品 12" },
    { "imageUrl": "/images/photo13.jpg", "title": "作品 13" },
    { "imageUrl": "/images/photo14.jpg", "title": "作品 14" },
    { "imageUrl": "/images/photo15.jpg", "title": "作品 15" },
    { "imageUrl": "/images/photo16.jpg", "title": "作品 16" }
];

// Each photo panel's properties interface
interface BoxInfo {
    name: string;
    position: Vector3;
    rotation: Vector3;
    imageUrl: string;
    width: number;
    height: number;
    depth: number;
    title: string;
    texture?: Texture; // Preloaded texture object
}

// Gallery content data type definition
interface GalleryDataItem {
    imageUrl: string;
    title: string;
}

// WebXR setup optimization with memoized handlers
const XRSceneManager: React.FC<{
    onGalleryRotate: (rotation: number) => void;
    toggleAudioRef: React.RefObject<(() => void) | null>;
    onNextPage: () => void;
}> = React.memo(({ onGalleryRotate, toggleAudioRef, onNextPage }) => {
    const scene = useScene();
    const onNextPageRef = useRef(onNextPage);

    useEffect(() => {
        onNextPageRef.current = onNextPage;
    }, [onNextPage]);

    const handleThumbstick = useCallback((axes: { x: number; y: number }) => {
        if (Math.abs(axes.x) > 0.1) {
            onGalleryRotate(-axes.x * 0.05);
        }
    }, [onGalleryRotate]);

    const handleTrigger = useCallback((component: any) => {
        if (component.changes.pressed?.current && !component.changes.pressed?.previous) {
            toggleAudioRef.current?.();
        }
    }, [toggleAudioRef]);

    const handleAButton = useCallback((component: any) => {
        if (component.changes.pressed?.current && !component.changes.pressed?.previous) {
            onNextPageRef.current();
        }
    }, []); // Empty dependency array ensures this callback is stable

    const setupController = useCallback((controller: any, motionController: any) => {
        if (!scene) return;
        
        // Setup thumbstick (common for both controllers)
        const thumbstick = motionController.getComponent('xr-standard-thumbstick');
        if (thumbstick) {
            thumbstick.onAxisValueChangedObservable.add(handleThumbstick);
        }

        const parentMesh = controller.grip || controller.pointer;
        if (!parentMesh) return;

        if (controller.inputSource.handedness === 'left') {
            // Left: Audio button control
            const audioButton = scene.getMeshByName("audio-button-text");
            if (audioButton) {
                audioButton.setParent(parentMesh);
                audioButton.position = new Vector3(0, 0.05, 0.1);
                audioButton.rotation = new Vector3(Math.PI / 4, 0, 0);
            }

            const triggerComponent = motionController.getComponent('xr-standard-trigger');
            if (triggerComponent) {
                triggerComponent.onButtonStateChangedObservable.add(handleTrigger);
            }
        } else if (controller.inputSource.handedness === 'right') {
            // Right: Page navigation control
            const pageNavParent = scene.getTransformNodeByName("page-nav-parent");
            if (pageNavParent) {
                pageNavParent.setParent(parentMesh);
                pageNavParent.position = new Vector3(0, 0.07, 0.1);
                pageNavParent.rotation = new Vector3(Math.PI / 4, 0, 0);
            }

            const aButton = motionController.getComponent('a-button');
            if (aButton) aButton.onButtonStateChangedObservable.add(handleAButton);
        }
    }, [scene, handleThumbstick, handleTrigger, handleAButton]);

    const setupXR = useCallback(async () => {
        if (!scene) return;

        try {
            const xr = await scene.createDefaultXRExperienceAsync({
                disableTeleportation: true,
                disablePointerSelection: true,
            });

            if (xr.baseExperience) {
                xr.input.onControllerAddedObservable.add((controller) => {
                    controller.onMotionControllerInitObservable.add((motionController) => {
                        setupController(controller, motionController);
                    });
                });

                xr.input.onControllerRemovedObservable.add((controller) => {
                    if (!scene) return;
                    
                    if (controller.inputSource.handedness === 'left') {
                        const audioButton = scene.getMeshByName("audio-button-text");
                        if (audioButton) {
                            audioButton.setParent(null);
                            audioButton.position = AUDIO_BUTTON_POSITION;
                            audioButton.rotation = Vector3.Zero();
                        }
                    } else if (controller.inputSource.handedness === 'right') {
                        const pageNavParent = scene.getTransformNodeByName("page-nav-parent");
                        if (pageNavParent) {
                            pageNavParent.setParent(null);
                            pageNavParent.position = PAGE_NAV_POSITION;
                            pageNavParent.rotation = Vector3.Zero();
                        }
                    }
                });
            }
        } catch (error) {
            console.warn('WebXR not supported or failed to initialize:', error);
        }
    }, [scene, setupController]);

    useEffect(() => {
        setupXR();
    }, [setupXR]);

    return null;
});

// Main Scene Component
const CirclePlanesScene: React.FC = () => {
    const [boxes, setBoxes] = useState<BoxInfo[]>([]);
    const [galleryData, setGalleryData] = useState<GalleryDataItem[]>([]);
    const [currentPage, setCurrentPage] = useState(0);
    const [galleryRotationY, setGalleryRotationY] = useState(0);
    const [sceneReady, setSceneReady] = useState(false);
    const [isAudioPlaying, setIsAudioPlaying] = useState(false);
    const [isPageChanging, setIsPageChanging] = useState(false);
    const shadowGeneratorRef = useRef<ShadowGenerator | null>(null);
    const sceneRef = useRef<Scene | null>(null);
    const playerRef = useRef<Tone.Player | null>(null);
    const toggleAudioRef = useRef<(() => void) | null>(null);

    // Fetch data from JSON file
    useEffect(() => {
        const fetchGalleryData = async () => {
            try {
                const response = await fetch('/photovr.json');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data: GalleryDataItem[] = await response.json();
                setGalleryData(data.length > 0 ? data : DEFAULT_GALLERY_DATA);
            } catch (error) {
                console.error('Failed to load gallery data, using default:', error);
                setGalleryData(DEFAULT_GALLERY_DATA);
            }
        };
        fetchGalleryData();
    }, []);

    const totalPages = useMemo(() => {
        return galleryData.length > 0 ? Math.ceil(galleryData.length / PHOTOS_PER_PAGE) : 1;
    }, [galleryData.length]);

    const currentPhotos = useMemo(() => {
        const start = currentPage * PHOTOS_PER_PAGE;
        const end = start + PHOTOS_PER_PAGE;
        return galleryData.slice(start, end);
    }, [galleryData, currentPage]);

    // Streamline image dimension and texture generation
    const createBoxInfo = useCallback((item: GalleryDataItem, index: number, total: number): Promise<BoxInfo> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            
            const handleLoad = () => {
                const aspectRatio = img.naturalWidth / img.naturalHeight;
                const width = PANEL_WIDTH;
                const height = width / aspectRatio;
                const angle = (index / total) * 2 * Math.PI;
                const x = GALLERY_RADIUS * Math.cos(angle);
                const z = GALLERY_RADIUS * Math.sin(angle);
                // The Y position is calculated here. Changed 0.8 to 1.3 to raise the photos by 50cm.
                const position = new Vector3(x, height / 2 + 1.3, z);
                const rotation = new Vector3(0, -angle + Math.PI / 2, 0);

                const texture = new Texture(
                    item.imageUrl, 
                    sceneRef.current!, 
                    false, 
                    true, 
                    Texture.BILINEAR_SAMPLINGMODE,
                    () => resolve({
                        name: `box-${index}`,
                        position,
                        rotation,
                        imageUrl: item.imageUrl,
                        width,
                        height,
                        depth: 0.001,
                        title: item.title,
                        texture,
                    }),
                    (msg) => reject(new Error(`Failed to load texture: ${item.imageUrl} - ${msg}`))
                );
            };

            const handleError = () => reject(new Error(`Failed to load image: ${item.imageUrl}`));
            
            img.onload = handleLoad;
            img.onerror = handleError;
            img.src = item.imageUrl;
        });
    }, []);

    const loadBoxesData = useCallback(async () => {
        if (!sceneRef.current || currentPhotos.length === 0) {
            if (boxes.length > 0) setBoxes([]);
            return;
        }

        try {
            const boxDataPromises = currentPhotos.map((item, index) => 
                createBoxInfo(item, index, currentPhotos.length)
            );
            const loadedBoxes = await Promise.all(boxDataPromises);
            setBoxes(loadedBoxes);
        } catch (error) {
            console.error("Error preloading images:", error);
            setBoxes([]);
        }
    }, [currentPhotos, createBoxInfo, boxes.length]);
    
    // This effect handles both initial and page change loads efficiently
    useEffect(() => {
        if (sceneReady && currentPhotos.length > 0 && boxes.length === 0) {
            loadBoxesData();
        }
    }, [sceneReady, currentPhotos, loadBoxesData]);


    useEffect(() => {
        playerRef.current = new Tone.Player("/mp3/photobgm.mp3").toDestination();
        playerRef.current.loop = true;
        return () => {
            if (Tone.getTransport().state !== 'stopped') {
                Tone.getTransport().stop();
                Tone.getTransport().cancel();
            }
            playerRef.current?.dispose();
        };
    }, []);

    const toggleAudio = useCallback(async () => {
        if (Tone.getContext().state !== 'running') {
            await Tone.start();
        }
        if (playerRef.current) {
            if (playerRef.current.state === 'started') {
                playerRef.current.stop();
                setIsAudioPlaying(false);
            } else {
                playerRef.current.start();
                setIsAudioPlaying(true);
            }
        }
    }, []);
    
    useEffect(() => {
        toggleAudioRef.current = toggleAudio;
    }, [toggleAudio]);

    const handleGalleryRotate = useCallback((rotationAmount: number) => {
        setGalleryRotationY((prev) => prev + rotationAmount);
    }, []);

    // Optimize animation management - reuse a single instance
    const animationManager = useMemo(() => ({
        animate: (target: any, property: string, from: number, to: number, easingFunction: EasingFunction, onComplete?: () => void) => {
            if (!sceneRef.current) return;
            Animation.CreateAndStartAnimation(
                `anim_${property}_${Date.now()}`,
                target,
                property,
                60,
                ANIMATION_DURATION_FRAMES,
                from,
                to,
                Animation.ANIMATIONLOOPMODE_CONSTANT,
                easingFunction,
                onComplete
            );
        }
    }), []);

    // Optimize generic animation function
    const runAnimation = useCallback((target: any, property: string, from: number, to: number, easingFunction: EasingFunction, onAnimationEnd?: () => void) => {
        animationManager.animate(target, property, from, to, easingFunction, onAnimationEnd);
    }, [animationManager]);

    // Page change handling
    const changePage = useCallback(() => {
        if (isPageChanging || !sceneRef.current) return;
        
        setIsPageChanging(true);
        const scene = sceneRef.current;
        
        if (boxes.length === 0) {
            const newPage = (currentPage + 1) % totalPages;
            setCurrentPage(newPage);
            setIsPageChanging(false);
            return;
        }

        let pendingAnimations = boxes.length;
        const onExitAnimationEnd = () => {
            if (--pendingAnimations === 0) {
                const newPage = (currentPage + 1) % totalPages;
                setBoxes([]);
                setCurrentPage(newPage);
            }
        };

        boxes.forEach(box => {
            const wrapperNode = scene.getTransformNodeByName(`item-wrapper-${box.name}`);
            if (wrapperNode) {
                const photoMesh = scene.getMeshByName(box.name);
                const titleBgMesh = scene.getMeshByName(`title-bg-${box.name}`);
                
                runAnimation(wrapperNode, 'position.y', wrapperNode.position.y, wrapperNode.position.y + ANIMATION_Y_OFFSET, EASE_IN_CUBIC, onExitAnimationEnd);
                if (photoMesh) runAnimation(photoMesh, 'visibility', 1, 0, EASE_IN_CUBIC);
                if (titleBgMesh) runAnimation(titleBgMesh, 'visibility', 1, 0, EASE_IN_CUBIC);
            } else {
                onExitAnimationEnd();
            }
        });
    }, [isPageChanging, boxes, currentPage, totalPages, runAnimation]);

    const handleNextPage = useCallback(() => changePage(), [changePage]);

    // Setup functions
    const setupShadowGenerator = useCallback((light: SpotLight) => {
        const generator = new ShadowGenerator(SHADOW_MAP_SIZE, light);
        generator.useBlurExponentialShadowMap = true;
        generator.blurKernel = 32;
        generator.darkness = 0.5;
        shadowGeneratorRef.current = generator;
    }, []);

    const handleAudioButtonClick = useCallback(() => {
        toggleAudioRef.current?.();
    }, []);

    // Entry animation handling
    const handleItemCreated = useCallback((node: TransformNode, isLast: boolean) => {
        if (!isPageChanging || !sceneRef.current) return;
            
        const finalPosition = node.position.clone();
        const childMeshes = node.getChildMeshes();
        const photoMesh = childMeshes.find(m => m.name.startsWith('box-'));
        const titleBgMesh = childMeshes.find(m => m.name.startsWith('title-bg-'));
        
        // Set initial state
        node.position.y += ANIMATION_Y_OFFSET;
        if (photoMesh) photoMesh.visibility = 0;
        if (titleBgMesh) titleBgMesh.visibility = 0;

        const onAnimationComplete = isLast ? () => setIsPageChanging(false) : undefined;
        
        runAnimation(node, 'position.y', node.position.y, finalPosition.y, EASE_OUT_CUBIC, onAnimationComplete);
        if (photoMesh) runAnimation(photoMesh, 'visibility', 0, 1, EASE_OUT_CUBIC);
        if (titleBgMesh) runAnimation(titleBgMesh, 'visibility', 0, 1, EASE_OUT_CUBIC);
    }, [isPageChanging, runAnimation]);

    // Gallery item creation
    const createGalleryItem = useCallback((box: BoxInfo, index: number) => {
        const plateHeight = 0.1;
        const verticalOffset = 0.05;
        const plateLocalY = -box.height / 2 - verticalOffset - plateHeight / 2;

        return (
            <React.Fragment key={box.name}>
                <transformNode 
                    name={`item-wrapper-${box.name}`} 
                    position={box.position} 
                    rotation={box.rotation}
                    onCreated={(node) => handleItemCreated(node as TransformNode, index === boxes.length - 1)}>
                    
                    <box name={box.name} width={box.width} height={box.height} depth={box.depth}
                        onCreated={(mesh: Mesh) => shadowGeneratorRef.current?.addShadowCaster(mesh)}>
                        <standardMaterial 
                            name={`${box.name}-mat`} 
                            diffuseTexture={box.texture} 
                            emissiveTexture={box.texture} 
                            specularColor={Color3.Black()} 
                        />
                    </box>
                    
                    <box 
                        name={`title-bg-${box.name}`} 
                        width={box.width + 0.05} 
                        height={plateHeight} 
                        depth={0.01} 
                        position={new Vector3(0, plateLocalY, -0.01)}
                        onCreated={(mesh: Mesh) => shadowGeneratorRef.current?.addShadowCaster(mesh)}>
                        <standardMaterial name={`title-bg-mat-${box.name}`} diffuseColor={Color3.Black()} alpha={0.7} />
                    </box>

                    <plane 
                        name={`title-plane-${box.name}`} 
                        width={box.width + 0.05} 
                        height={plateHeight} 
                        position={new Vector3(0, plateLocalY, -0.011)} 
                        isPickable={false}>
                        <advancedDynamicTexture 
                            name={`title-texture-${box.name}`} 
                            height={128} 
                            width={Math.round(128 * ((box.width + 0.05) / plateHeight))} 
                            createForParentMesh>
                            <textBlock 
                                name={`title-text-${box.name}`} 
                                text={box.title} 
                                color="white" 
                                fontSize={28} 
                                fontWeight="bold" 
                            />
                        </advancedDynamicTexture>
                    </plane>
                </transformNode>
            </React.Fragment>
        );
    }, [handleItemCreated, boxes.length]);


    return (
        <div className="relative w-full h-screen bg-gray-900">
            <BabylonEngine antialias adaptToDeviceRatio canvasId="babylonJS">
                <BabylonScene
                    clearColor={CLEAR_COLOR}
                    onCreated={(scene: Scene) => {
                        sceneRef.current = scene;
                        setSceneReady(true);
                    }}
                >
                    <XRSceneManager 
                        onGalleryRotate={handleGalleryRotate} 
                        toggleAudioRef={toggleAudioRef}
                        onNextPage={handleNextPage}
                    />

                    <universalCamera name="universalCamera" position={CAMERA_POSITION} minZ={0.1} />
                    <hemisphericLight name="hemiLight" intensity={0.5} direction={Vector3.Up()} />
                    <spotLight
                        name="spotLight"
                        position={new Vector3(0, 5, 0)}
                        direction={new Vector3(0, -1, 0)}
                        angle={Math.PI / 3}
                        exponent={2}
                        intensity={100}
                        onCreated={setupShadowGenerator}
                    />
                    <ground name="ground" width={GROUND_SIZE} height={GROUND_SIZE} receiveShadows>
                        <standardMaterial name="ground-mat" diffuseColor={GROUND_COLOR} specularColor={Color3.Black()} />
                    </ground>

                    {/* BGM Button */}
                    <plane
                        name="audio-button-text"
                        width={0.15} height={0.08}
                        position={AUDIO_BUTTON_POSITION}
                        onCreated={(mesh: Mesh) => {
                            if (!sceneRef.current) return;
                            mesh.actionManager = new ActionManager(sceneRef.current);
                            mesh.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnPickTrigger, handleAudioButtonClick));
                        }}
                    >
                        <advancedDynamicTexture name="audio-button-text-texture" height={128} width={256} createForParentMesh>
                            <rectangle name="text-background" cornerRadius={10} background={isAudioPlaying ? "rgba(102, 204, 255, 0.7)" : "rgba(128, 128, 128, 0.7)"}>
                                <textBlock name="audio-button-label" text={isAudioPlaying ? "♪ BGM ON" : "🔇 BGM OFF"} color="white" fontSize={28} fontWeight="bold"/>
                            </rectangle>
                        </advancedDynamicTexture>
                    </plane>

                    {/* Page Navigation UI */}
                    <transformNode name="page-nav-parent" position={PAGE_NAV_POSITION}>
                        <plane name="page-info" width={0.35} height={0.1} position={new Vector3(0, 0, 0)} isPickable={false}>
                            <advancedDynamicTexture name="page-info-texture" height={128} width={256} createForParentMesh>
                                <textBlock name="page-info-text" text={`Page ${currentPage + 1} / ${totalPages}`} color="white" fontSize={32} fontWeight="bold" />
                            </advancedDynamicTexture>
                        </plane>
                    </transformNode>
                    
                    {/* Gallery Parent Node */}
                    <transformNode name="gallery-parent" rotation={new Vector3(0, galleryRotationY, 0)}>
                        {boxes.map(createGalleryItem)}
                    </transformNode>
                </BabylonScene>
            </BabylonEngine>
        </div>
    );
};

const App = React.memo(function App() {
    return <CirclePlanesScene />;
});

export default App;
