/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter';
import { Upload, Download, Info, Music, Sliders, ChevronDown, Circle, Box, Square, Hexagon, Component, Monitor, Disc, Key, Bookmark as BookmarkIcon, Frame } from 'lucide-react';

// --- Utility Hooks ---
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// --- Types ---
interface ParamState {
  productType: 'Keychain' | 'DeskBlock' | 'Coaster' | 'WallArt' | 'Bookmark';
  resolution: number;
  baseThickness: number;
  codeThickness: number;
  tabExtension: number;
  holeSize: number;
  style: 'Smooth' | 'Faceted' | 'Chamfered';
  baseForm: 'Pill' | 'RoundedRect' | 'Rectangle' | 'Hexagon';
}

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  
  // App State
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isReadyForDownload, setIsReadyForDownload] = useState(false);

  // Parametric Settings State
  const [params, setParams] = useState<ParamState>({
    productType: 'Keychain',
    resolution: 32,
    baseThickness: 2,
    codeThickness: 2,
    tabExtension: 0.4,
    holeSize: 0.15,
    style: 'Smooth',
    baseForm: 'Pill',
  });
  
  // Debounce params so dragging sliders doesn't kill the thread
  const debouncedParams = useDebounce(params, 150);

  // Refs for Three.js
  const sceneRef = useRef<THREE.Scene | null>(null);
  const exportGroupRef = useRef<THREE.Group | null>(null);

  // Initialize Three.js scene (Runs Once)
  useEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount) return;

    // SCENE
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#121212');
    scene.fog = new THREE.FogExp2('#121212', 0.007);
    sceneRef.current = scene;

    // CAMERA
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(0, 150, 250);

    // RENDERER
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio); // important for sharpness on high dpi displays
    renderer.shadowMap.enabled = true;
    currentMount.appendChild(renderer.domElement);

    // CONTROLS
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.1; // Restrict from going too far below the grid
    controls.minDistance = 30;
    controls.maxDistance = 800;
    controls.target.set(0, 0, 0);

    // LIGHTS
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(20, 60, 40);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    const backLight = new THREE.DirectionalLight(0x1DB954, 0.5);
    backLight.position.set(-20, -20, -40);
    scene.add(backLight);

    // GENERATIVE WAVE GRID (Computational Aesthetics)
    const planeGeo = new THREE.PlaneGeometry(300, 300, 60, 60);
    planeGeo.rotateX(-Math.PI / 2);
    const planeMat = new THREE.MeshBasicMaterial({ 
      color: 0x1DB954, 
      wireframe: true, 
      transparent: true, 
      opacity: 0.1,
      side: THREE.DoubleSide
    });
    const generativeGrid = new THREE.Mesh(planeGeo, planeMat);
    generativeGrid.position.y = -20;
    scene.add(generativeGrid);

    // INITIAL PLACEHOLDER (So the scene isn't completely empty)
    const placeholderGeo = new THREE.BoxGeometry(60, 20, 4);
    const placeholderMat = new THREE.MeshStandardMaterial({ color: 0x222222, flatShading: true });
    const placeholder = new THREE.Mesh(placeholderGeo, placeholderMat);
    placeholder.position.y = 5;
    placeholder.castShadow = true;
    exportGroupRef.current = new THREE.Group();
    exportGroupRef.current.add(placeholder);
    scene.add(exportGroupRef.current);

    // ANIMATION LOOP
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      
      const time = Date.now() * 0.001;
      
      // Animate Generative Grid
      if (generativeGrid) {
        const pos = planeGeo.attributes.position;
        for(let i = 0; i < pos.count; i++) {
          const x = pos.getX(i);
          const z = pos.getZ(i);
          // Parametric wave equation based on audio-like frequencies
          const y = Math.sin(x * 0.05 + time) * Math.cos(z * 0.05 + time * 0.8) * 4;
          pos.setY(i, y);
        }
        pos.needsUpdate = true;
      }

      // Slightly float the model if not interacting
      if (exportGroupRef.current) {
        exportGroupRef.current.position.y = Math.sin(time * 2) * 1.5;
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // RESIZE
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      if (currentMount && currentMount.contains(renderer.domElement)) {
        currentMount.removeChild(renderer.domElement);
      }
      controls.dispose();
      renderer.dispose();
      planeGeo.dispose();
      planeMat.dispose();
    };
  }, []);

  // Re-run SVG processing when debouncedParams or svgContent changes
  useEffect(() => {
    if (!svgContent) return;
    processSVG(svgContent, debouncedParams);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svgContent, debouncedParams]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsGenerating(true);
    setIsReadyForDownload(false);

    const reader = new FileReader();
    reader.onload = (e) => {
      const contents = e.target?.result as string;
      setSvgContent(contents); // Triggers useEffect
    };
    reader.readAsText(file);
  };

  const processSVG = (content: string, p: ParamState) => {
    if (!sceneRef.current) return;
    
    try {
      if (exportGroupRef.current) {
        sceneRef.current.remove(exportGroupRef.current);
      }

      const loader = new SVGLoader();
      const svgData = loader.parse(content);

      let maxArea = -1;
      let baseShapeConfig: any = null;
      const codeShapesConfig: any[] = [];

      // Pass 1: Parse shapes and isolate Base vs Code segments
      svgData.paths.forEach((path) => {
        const shapes = SVGLoader.createShapes(path);
        shapes.forEach((shape) => {
          const geometry = new THREE.ShapeGeometry(shape);
          geometry.computeBoundingBox();
          const bbox = geometry.boundingBox;
          if (!bbox) return;

          const width = bbox.max.x - bbox.min.x;
          const height = bbox.max.y - bbox.min.y;
          const area = width * height;

          if (area > maxArea) {
            if (baseShapeConfig) codeShapesConfig.push(baseShapeConfig);
            maxArea = area;
            baseShapeConfig = { shape, bbox, width, height, area };
          } else {
            codeShapesConfig.push({ shape, area });
          }
        });
      });

      if (!baseShapeConfig) throw new Error("Invalid Spotify Code SVG.");

      // Computational Form Drivers
      const isFaceted = p.style === 'Faceted';
      const curveSegments = isFaceted ? 3 : p.resolution;
      let bevelEnabled = true;
      let bevelSegments = 3;
      let bevelSize = 0.5;

      if (p.style === 'Faceted') {
        bevelSegments = 1;
        bevelSize = 0.8;
      } else if (p.style === 'Chamfered') {
        bevelSegments = 1;
        bevelSize = 1.0;
      }

      const { bbox, width, height, area: baseArea } = baseShapeConfig;
      const minX = bbox.min.x;
      const maxX = bbox.max.x;
      const minY = bbox.min.y;
      const maxY = bbox.max.y;
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const r = height / 2;

      const newBaseShape = new THREE.Shape();
      let actualBaseThickness = p.baseThickness;

      if (p.productType === 'Keychain') {
        // --- KEYCHAIN LOGIC ---
        const tabWidth = height * p.tabExtension;
        const newMinX = minX - tabWidth;
        const cxLeft = newMinX + r;
        const cxRight = maxX - r;

        if (p.baseForm === 'Pill') {
          newBaseShape.moveTo(cxLeft, maxY);
          newBaseShape.lineTo(cxRight, maxY);
          newBaseShape.absarc(cxRight, cy, r, Math.PI / 2, -Math.PI / 2, true); 
          newBaseShape.lineTo(cxLeft, minY);
          newBaseShape.absarc(cxLeft, cy, r, -Math.PI / 2, Math.PI / 2, true); 
        } else if (p.baseForm === 'Rectangle') {
          newBaseShape.moveTo(newMinX, maxY);
          newBaseShape.lineTo(maxX, maxY);
          newBaseShape.lineTo(maxX, minY);
          newBaseShape.lineTo(newMinX, minY);
          newBaseShape.lineTo(newMinX, maxY);
        } else if (p.baseForm === 'RoundedRect') {
          const radius = r * 0.4;
          newBaseShape.moveTo(newMinX + radius, maxY);
          newBaseShape.lineTo(maxX - radius, maxY);
          newBaseShape.quadraticCurveTo(maxX, maxY, maxX, maxY - radius);
          newBaseShape.lineTo(maxX, minY + radius);
          newBaseShape.quadraticCurveTo(maxX, minY, maxX - radius, minY);
          newBaseShape.lineTo(newMinX + radius, minY);
          newBaseShape.quadraticCurveTo(newMinX, minY, newMinX, minY + radius);
          newBaseShape.lineTo(newMinX, maxY - radius);
          newBaseShape.quadraticCurveTo(newMinX, maxY, newMinX + radius, maxY);
        } else if (p.baseForm === 'Hexagon') {
          const chamfer = height * 0.3;
          newBaseShape.moveTo(newMinX, cy);
          newBaseShape.lineTo(newMinX + chamfer, maxY);
          newBaseShape.lineTo(maxX - chamfer, maxY);
          newBaseShape.lineTo(maxX, cy);
          newBaseShape.lineTo(maxX - chamfer, minY);
          newBaseShape.lineTo(newMinX + chamfer, minY);
          newBaseShape.lineTo(newMinX, cy);
        }

        // Hole position is always aligned to the left tab center
        const holeRadius = height * p.holeSize;
        const holePath = new THREE.Path();
        holePath.absarc(cxLeft, cy, holeRadius, 0, Math.PI * 2, false);
        newBaseShape.holes.push(holePath);

      } else if (p.productType === 'DeskBlock') {
        // --- DESK BLOCK LOGIC ---
        actualBaseThickness = p.baseThickness * 3; // Thicker base for standing
        const paddingX = height * 0.8;
        const paddingY = height * 0.6;
        const newMinX = minX - paddingX;
        const newMaxX = maxX + paddingX;
        const newMinY = minY - paddingY;
        const newMaxY = maxY + paddingY;

        if (p.baseForm === 'RoundedRect' || p.baseForm === 'Pill') {
           const radius = height * 0.4;
           newBaseShape.moveTo(newMinX + radius, newMaxY);
           newBaseShape.lineTo(newMaxX - radius, newMaxY);
           newBaseShape.quadraticCurveTo(newMaxX, newMaxY, newMaxX, newMaxY - radius);
           newBaseShape.lineTo(newMaxX, newMinY + radius);
           newBaseShape.quadraticCurveTo(newMaxX, newMinY, newMaxX - radius, newMinY);
           newBaseShape.lineTo(newMinX + radius, newMinY);
           newBaseShape.quadraticCurveTo(newMinX, newMinY, newMinX, newMinY + radius);
           newBaseShape.lineTo(newMinX, newMaxY - radius);
           newBaseShape.quadraticCurveTo(newMinX, newMaxY, newMinX + radius, newMaxY);
        } else {
           // Default to Rectangle for robust standing
           newBaseShape.moveTo(newMinX, newMaxY);
           newBaseShape.lineTo(newMaxX, newMaxY);
           newBaseShape.lineTo(newMaxX, newMinY);
           newBaseShape.lineTo(newMinX, newMinY);
           newBaseShape.lineTo(newMinX, newMaxY);
        }

      } else if (p.productType === 'Coaster') {
        // --- COASTER LOGIC ---
        actualBaseThickness = p.baseThickness * 1.5;
        // Make a perfect circle that envelopes the code
        const coasterRadius = width * 0.55; 
        
        if (p.baseForm === 'Hexagon') {
           for (let i = 0; i < 6; i++) {
             const angle = (Math.PI / 3) * i;
             const x = cx + coasterRadius * Math.cos(angle);
             const y = cy + coasterRadius * Math.sin(angle);
             if (i === 0) newBaseShape.moveTo(x, y);
             else newBaseShape.lineTo(x, y);
           }
           newBaseShape.lineTo(cx + coasterRadius, cy);
        } else if (p.baseForm === 'Rectangle' || p.baseForm === 'RoundedRect') {
           const sqSize = coasterRadius * 1.8;
           const sRadius = p.baseForm === 'RoundedRect' ? sqSize * 0.1 : 0;
           const nMinX = cx - sqSize/2;
           const nMaxX = cx + sqSize/2;
           const nMinY = cy - sqSize/2;
           const nMaxY = cy + sqSize/2;
           
           if (sRadius > 0) {
             newBaseShape.moveTo(nMinX + sRadius, nMaxY);
             newBaseShape.lineTo(nMaxX - sRadius, nMaxY);
             newBaseShape.quadraticCurveTo(nMaxX, nMaxY, nMaxX, nMaxY - sRadius);
             newBaseShape.lineTo(nMaxX, nMinY + sRadius);
             newBaseShape.quadraticCurveTo(nMaxX, nMinY, nMaxX - sRadius, nMinY);
             newBaseShape.lineTo(nMinX + sRadius, nMinY);
             newBaseShape.quadraticCurveTo(nMinX, nMinY, nMinX, nMinY + sRadius);
             newBaseShape.lineTo(nMinX, nMaxY - sRadius);
             newBaseShape.quadraticCurveTo(nMinX, nMaxY, nMinX + sRadius, nMaxY);
           } else {
             newBaseShape.moveTo(nMinX, nMaxY);
             newBaseShape.lineTo(nMaxX, nMaxY);
             newBaseShape.lineTo(nMaxX, nMinY);
             newBaseShape.lineTo(nMinX, nMinY);
             newBaseShape.lineTo(nMinX, nMaxY);
           }
        } else {
           // Default to true circle
           newBaseShape.absarc(cx, cy, coasterRadius, 0, Math.PI * 2, false);
        }
      }

      // Base Extrusion
      const baseMaterial = new THREE.MeshStandardMaterial({
        color: 0x222222,
        roughness: 0.8,
        metalness: 0.2,
        flatShading: isFaceted
      });
      const baseExtrudeSettings = {
        depth: actualBaseThickness,
        curveSegments,
        bevelEnabled,
        bevelSegments,
        steps: 1,
        bevelSize,
        bevelThickness: bevelSize,
      };
      
      const baseGeometry = new THREE.ExtrudeGeometry(newBaseShape, baseExtrudeSettings);
      const baseMesh = new THREE.Mesh(baseGeometry, baseMaterial);
      baseMesh.castShadow = true;
      baseMesh.receiveShadow = true;

      // Pass 3: Process the Spotify Code paths
      const codeMaterial = new THREE.MeshStandardMaterial({
        color: 0x1DB954,
        emissive: 0x1DB954,
        emissiveIntensity: 0.1,
        roughness: 0.4,
        flatShading: isFaceted
      });
      
      const codeExtrudeSettings = { 
        depth: actualBaseThickness + p.codeThickness, // Sits on top of the base exactly
        curveSegments, 
        bevelEnabled: false 
      };
      const codeGroup = new THREE.Group();

      const thresholdArea = baseArea * 0.0001; // Ignore tiny artifacts
      codeShapesConfig.forEach((config) => {
        if (config.area > thresholdArea) {
          const geometry = new THREE.ExtrudeGeometry(config.shape, codeExtrudeSettings);
          const mesh = new THREE.Mesh(geometry, codeMaterial);
          mesh.castShadow = true;
          codeGroup.add(mesh);
        }
      });

      // Assembly
      const group = new THREE.Group();
      group.add(baseMesh);
      group.add(codeGroup);

      // Rotation & Scaling to printable baseline
      group.rotation.x = Math.PI; 
      
      const box1 = new THREE.Box3().setFromObject(group);
      const sizeStr = box1.getSize(new THREE.Vector3());
      
      // Scale standard lengths
      let targetSize = 60; // Keychain typical length
      if (p.productType === 'DeskBlock') targetSize = 120;
      if (p.productType === 'Coaster') targetSize = 90;
      if (p.productType === 'WallArt') targetSize = 250;
      if (p.productType === 'Bookmark') targetSize = 140;

      if (sizeStr.x > 0) {
        let scaleFactor = targetSize / sizeStr.x;
        // If coaster, we scale by largest dimension essentially
        if (p.productType === 'Coaster') {
            scaleFactor = targetSize / Math.max(sizeStr.x, sizeStr.z);
        }
        group.scale.set(scaleFactor, scaleFactor, scaleFactor);
      }

      // Center around origin
      const box2 = new THREE.Box3().setFromObject(group);
      const center = box2.getCenter(new THREE.Vector3());
      
      // Shift so the base sits nicely on Y=0
      const bottomY = box2.min.y;
      group.position.set(-center.x, -bottomY, -center.z); 

      const wrapper = new THREE.Group();
      wrapper.add(group);

      // Add a simple geometric prop for DeskBlocks to stand up if needed visually? 
      // Nah, let the exporter handle it flat, it's better for 3D printing

      sceneRef.current.add(wrapper);
      exportGroupRef.current = wrapper;

      setIsGenerating(false);
      setIsReadyForDownload(true);
    } catch (error) {
      console.error(error);
      alert("Error processing SVG. Ensure it's a valid Spotify Code SVG.");
      setIsGenerating(false);
    }
  };

  const handleDownloadSTL = () => {
    if (!exportGroupRef.current) return;

    // Reset floating animation temporarily to ensure export is centered at origin
    const originalY = exportGroupRef.current.position.y;
    exportGroupRef.current.position.y = 0;
    exportGroupRef.current.updateMatrixWorld(true);

    const exporter = new STLExporter();
    const stlString = exporter.parse(exportGroupRef.current);
    
    // Restore animation state
    exportGroupRef.current.position.y = originalY;

    const blob = new Blob([stlString], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = url;
    link.download = `Spotify_${params.productType}_3D.stl`;
    document.body.appendChild(link);
    link.click();
    
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  };

  const handleParamChange = (key: keyof ParamState, val: string | number) => {
    setParams(prev => ({ ...prev, [key]: val }));
  };

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-[#121212] select-none font-sans">
      {/* 3D Canvas Container */}
      <div ref={mountRef} className="absolute inset-0 z-0 cursor-move" />
      
      {/* LEFT PANEL */}
      <div className="absolute top-4 left-4 z-10 w-[calc(100vw-2rem)] md:w-96 flex flex-col pointer-events-none">
        <div className="bg-[#181818]/90 backdrop-blur-md border border-[#282828] p-5 md:p-6 rounded-2xl shadow-2xl text-white pointer-events-auto">
          <h1 className="text-2xl font-bold flex items-center gap-3 text-[#1DB954] mb-4 tracking-tight">
              <Music className="w-6 h-6" />
              Spotify 3D Studio
            </h1>
            
            <div className="bg-[#222222] p-4 rounded-xl mb-4 text-sm text-gray-300 border border-[#333333]">
              <h2 className="font-semibold text-white flex items-center gap-2 mb-2">
                 <Info className="w-4 h-4 text-[#1DB954]" />
                 Instructions
              </h2>
              <ol className="list-decimal pl-4 space-y-1.5 marker:text-[#1DB954]">
                <li>Go to <a href="https://www.spotifycodes.com" target="_blank" rel="noreferrer" className="text-[#1DB954] hover:underline font-medium">spotifycodes.com</a></li>
                <li>Change format to <strong className="text-white">SVG</strong>.</li>
                <li>Upload below, then use the right panel to customize your product!</li>
              </ol>
            </div>

            <div className="flex flex-col gap-3">
              <label className={`relative flex items-center justify-center w-full ${isGenerating ? 'bg-[#1DB954]/50 cursor-not-allowed' : 'bg-[#1DB954] hover:bg-[#1ed760] cursor-pointer'} text-black font-semibold py-3 px-4 rounded-full transition-colors`}>
                <Upload className="w-5 h-5 mr-2" />
                <span>{isGenerating ? 'Processing...' : 'Upload Spotify SVG'}</span>
                <input 
                  type="file" 
                  accept=".svg" 
                  className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed" 
                  onChange={handleFileUpload} 
                  disabled={isGenerating} 
                />
              </label>
              
              {isReadyForDownload && !isGenerating && (
              <button
                onClick={handleDownloadSTL}
                className="flex items-center justify-center w-full bg-[#121212] border border-[#1DB954] text-[#1DB954] hover:bg-[#1DB954]/10 font-semibold py-3 px-4 rounded-full transition-colors"
              >
                <Download className="w-5 h-5 mr-2" />
                Export STL for Printing
              </button>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL - PARAMETRIC CONTROLS */}
      {svgContent && (
        <div className="absolute top-96 md:top-4 right-4 z-10 w-[calc(100vw-2rem)] md:w-80 flex flex-col pointer-events-none max-h-[calc(100dvh-2rem)] pb-4 md:pb-0">
          <div className="bg-[#181818]/90 backdrop-blur-md border border-[#282828] p-4 md:p-5 rounded-2xl shadow-2xl text-white flex-1 overflow-y-auto custom-scrollbar pointer-events-auto">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-4 text-[#1DB954]">
              <Component className="w-5 h-5" /> Product Engineer
            </h2>
              
              <div className="space-y-5">
                
                {/* Product Type Selector */}
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-semibold text-[#1DB954] uppercase tracking-wider">Product Type</label>
                  <div className="grid grid-cols-1 gap-1.5">
                    {[
                      { id: 'Keychain', icon: Key, label: 'Keychain', desc: 'Portable accessory' },
                      { id: 'DeskBlock', icon: Monitor, label: 'Desk Plaque', desc: 'Thick freestanding sign' },
                      { id: 'Coaster', icon: Disc, label: 'Drink Coaster', desc: 'Large flat surface' },
                      { id: 'WallArt', icon: Frame, label: 'Wall Art', desc: 'Large scale display' },
                      { id: 'Bookmark', icon: BookmarkIcon, label: 'Bookmark', desc: 'Thin and flat' }
                    ].map(type => (
                      <button
                        key={type.id}
                        onClick={() => handleParamChange('productType', type.id)}
                        className={`flex items-center text-left p-2 rounded-xl border transition-all ${
                          params.productType === type.id 
                            ? 'border-[#1DB954] bg-[#1DB954]/10 ring-1 ring-[#1DB954]/50' 
                            : 'border-[#333333] bg-[#222222] hover:border-gray-500'
                        }`}
                      >
                        <div className={`p-2 rounded-lg ${params.productType === type.id ? 'bg-[#1DB954] text-black' : 'bg-[#333333] text-gray-400'}`}>
                          <type.icon className="w-4 h-4" />
                        </div>
                        <div className="ml-3">
                          <div className={`text-sm font-bold ${params.productType === type.id ? 'text-[#1DB954]' : 'text-white'}`}>{type.label}</div>
                          <div className="text-[10px] text-gray-400">{type.desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-px bg-[#333333] w-full" />

                {/* Geometric Style Dropdown */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Geometric Style</label>
                  <div className="relative">
                    <select 
                      value={params.style}
                      onChange={(e) => handleParamChange('style', e.target.value)}
                      className="w-full bg-[#222222] border border-[#333333] rounded-lg py-1.5 pl-3 pr-8 text-sm outline-none focus:border-[#1DB954] appearance-none transition-colors cursor-pointer"
                    >
                      <option value="Smooth">Smooth (Classic)</option>
                      <option value="Faceted">Faceted (Low-Poly)</option>
                      <option value="Chamfered">Chamfered (Industrial)</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                {/* Form Option Cards */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Base Shape</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { id: 'Pill', icon: Circle, label: 'Pill' },
                      { id: 'RoundedRect', icon: Box, label: 'Rounded' },
                      { id: 'Rectangle', icon: Square, label: 'Sharp' },
                      { id: 'Hexagon', icon: Hexagon, label: 'Hex' }
                    ].map(form => (
                      <button
                        key={form.id}
                        onClick={() => handleParamChange('baseForm', form.id)}
                        title={form.label}
                        className={`flex justify-center items-center py-2 rounded-lg border transition-colors ${
                          params.baseForm === form.id 
                            ? 'border-[#1DB954] bg-[#1DB954]/20 text-[#1DB954]' 
                            : 'border-[#333333] bg-[#222222] text-gray-400 hover:border-gray-500 hover:text-white'
                        }`}
                      >
                        <form.icon className="w-4 h-4" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 pt-1">
                  <ControlSlider 
                    label="Mesh Resolution" 
                    value={params.resolution} min={4} max={64} step={1} 
                    onChange={(v) => handleParamChange('resolution', v)} 
                    disabled={params.style === 'Faceted'}
                  />
                  <ControlSlider 
                    label="Base Thickness" 
                    value={params.baseThickness} min={1.0} max={6.0} step={0.5} 
                    onChange={(v) => handleParamChange('baseThickness', v)} 
                    unit="mm" 
                  />
                  <ControlSlider 
                    label="Code Extrusion" 
                    value={params.codeThickness} min={0.5} max={6.0} step={0.5} 
                    onChange={(v) => handleParamChange('codeThickness', v)} 
                    unit="mm" 
                  />
                  
                  {(params.productType === 'Keychain' || params.productType === 'Bookmark') && (
                    <>
                      <ControlSlider 
                        label="Tab Reach" 
                        value={params.tabExtension} min={0.2} max={1.0} step={0.1} 
                        onChange={(v) => handleParamChange('tabExtension', v)} 
                      />
                      <ControlSlider 
                        label="Hole Density" 
                        value={params.holeSize} min={0.05} max={0.3} step={0.02} 
                        onChange={(v) => handleParamChange('holeSize', v)} 
                      />
                    </  >
                  )}
                </div>
              </div>
            </div>
          </div>
      )}
    </div>
  );
}

// --- Helper UI Components ---
function ControlSlider({ 
  label, value, min, max, step, onChange, unit = "", disabled = false 
}: { 
  label: string, value: number, min: number, max: number, step: number, onChange: (v: number) => void, unit?: string, disabled?: boolean 
}) {
  return (
    <div className={`flex flex-col gap-1 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      <div className="flex justify-between items-end">
        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</label>
        <span className="text-[10px] font-mono text-[#1DB954]">{value.toFixed(step % 1 === 0 ? 0 : 2)}{unit}</span>
      </div>
      <input 
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-[#333333] rounded-lg appearance-none cursor-pointer accent-[#1DB954]"
      />
    </div>
  );
}



