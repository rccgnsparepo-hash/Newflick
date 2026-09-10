import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Crop,
  Check,
  RotateCw,
  FlipHorizontal,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize,
  Smartphone,
  Monitor,
  Laptop,
  Tablet,
  Square,
  Sparkles,
  Layers,
  X
} from 'lucide-react';
import { analyzeImageBrightness } from '../lib/wallpaperData';

export interface CropResult {
  dataUrl: string;
  blob: Blob;
  aspectRatioLabel: string;
  luminance: number;
  width: number;
  height: number;
}

interface WallpaperCanvasCropperProps {
  sourceImage: string; // Master image dataUrl or URL
  fileName?: string;
  initialAspectRatio?: string;
  onApplyCrop: (result: CropResult) => void;
  onCancel: () => void;
}

interface AspectRatioOption {
  id: string;
  label: string;
  category: string;
  ratio: number | null; // width / height, or null for freeform
  icon: React.ElementType;
  description: string;
}

export const WallpaperCanvasCropper: React.FC<WallpaperCanvasCropperProps> = ({
  sourceImage,
  fileName = 'custom_wallpaper.png',
  initialAspectRatio = '16:9',
  onApplyCrop,
  onCancel
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Loaded image ref
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Transformations
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0); // 0, 90, 180, 270
  const [isFlippedH, setIsFlippedH] = useState<boolean>(false);

  // Active aspect ratio preset
  const [selectedRatioId, setSelectedRatioId] = useState<string>(initialAspectRatio);

  // Crop box in Normalized Coordinates (0 to 1 relative to displayed image rect)
  // [x, y, width, height]
  const [cropBox, setCropBox] = useState<{ x: number; y: number; w: number; h: number }>({
    x: 0.05,
    y: 0.05,
    w: 0.9,
    h: 0.9
  });

  // Current interaction state for drag & resize
  const dragModeRef = useRef<
    'none' | 'move' | 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w'
  >('none');
  const dragStartPosRef = useRef<{ clientX: number; clientY: number }>({ clientX: 0, clientY: 0 });
  const initialCropBoxRef = useRef<{ x: number; y: number; w: number; h: number }>({
    x: 0,
    y: 0,
    w: 0,
    h: 0
  });

  // Aspect ratio presets for diverse screens
  const getDeviceRatio = (): number => {
    if (typeof window !== 'undefined' && window.innerHeight > 0) {
      return window.innerWidth / window.innerHeight;
    }
    return 16 / 9;
  };

  const ASPECT_PRESETS: AspectRatioOption[] = [
    {
      id: '16:9',
      label: '16:9 Desktop',
      category: 'Desktop',
      ratio: 16 / 9,
      icon: Monitor,
      description: 'Standard widescreen monitor / 1080p / 4K UHD'
    },
    {
      id: '9:16',
      label: '9:16 Mobile',
      category: 'Mobile',
      ratio: 9 / 16,
      icon: Smartphone,
      description: 'Vertical smartphone display & mobile screens'
    },
    {
      id: '16:10',
      label: '16:10 Laptop',
      category: 'Laptop',
      ratio: 16 / 10,
      icon: Laptop,
      description: 'MacBook & productivity laptop screens'
    },
    {
      id: '21:9',
      label: '21:9 Ultrawide',
      category: 'Ultrawide',
      ratio: 21 / 9,
      icon: Maximize,
      description: 'Curved and ultrawide panoramic displays'
    },
    {
      id: '4:3',
      label: '4:3 Tablet',
      category: 'Tablet',
      ratio: 4 / 3,
      icon: Tablet,
      description: 'iPad & standard tablet screens'
    },
    {
      id: '1:1',
      label: '1:1 Square',
      category: 'Square',
      ratio: 1,
      icon: Square,
      description: 'Square central focal crop'
    },
    {
      id: 'device',
      label: 'Active Screen',
      category: 'Auto',
      ratio: getDeviceRatio(),
      icon: Sparkles,
      description: 'Matches this specific device viewport exactly'
    },
    {
      id: 'free',
      label: 'Freeform',
      category: 'Custom',
      ratio: null,
      icon: Crop,
      description: 'Freely resize and drag any custom bounds'
    }
  ];

  // Load the master source image
  useEffect(() => {
    setImageLoaded(false);
    setImageError('');
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      imgRef.current = img;
      setImageLoaded(true);
      applyAspectRatio(initialAspectRatio, img.width, img.height);
    };

    img.onerror = () => {
      setImageError('Failed to load image for cropping.');
    };

    img.src = sourceImage;
  }, [sourceImage]);

  // Adjust crop box based on selected aspect ratio
  const applyAspectRatio = useCallback(
    (ratioId: string, imgW?: number, imgH?: number) => {
      setSelectedRatioId(ratioId);
      const img = imgRef.current;
      const w = imgW || img?.width || 1000;
      const h = imgH || img?.height || 1000;

      const preset = ASPECT_PRESETS.find((p) => p.id === ratioId);
      let targetRatio = preset ? preset.ratio : null;

      if (ratioId === 'device') {
        targetRatio = getDeviceRatio();
      }

      if (!targetRatio) {
        // Freeform: default 85% centered
        setCropBox({
          x: 0.075,
          y: 0.075,
          w: 0.85,
          h: 0.85
        });
        return;
      }

      // Compute normalized dimensions that fit target aspect ratio over image
      const imageRatio = w / h;
      let newW: number;
      let newH: number;

      if (targetRatio >= imageRatio) {
        // Target is wider than image: constrained by image width
        newW = 0.94;
        newH = (newW * imageRatio) / targetRatio;
        if (newH > 0.94) {
          newH = 0.94;
          newW = (newH * targetRatio) / imageRatio;
        }
      } else {
        // Target is taller than image: constrained by image height
        newH = 0.94;
        newW = (newH * targetRatio) / imageRatio;
        if (newW > 0.94) {
          newW = 0.94;
          newH = (newW * imageRatio) / targetRatio;
        }
      }

      const newX = (1 - newW) / 2;
      const newY = (1 - newH) / 2;

      setCropBox({
        x: Math.max(0, Math.min(1 - newW, newX)),
        y: Math.max(0, Math.min(1 - newH, newY)),
        w: Math.min(1, newW),
        h: Math.min(1, newH)
      });
    },
    []
  );

  // Redraw Canvas
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const img = imgRef.current;
    if (!canvas || !container || !img || !imageLoaded) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get container dimensions
    const cWidth = container.clientWidth || 600;
    const cHeight = Math.min(480, Math.max(320, container.clientHeight || 420));

    // High DPI Support
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cWidth * dpr;
    canvas.height = cHeight * dpr;
    canvas.style.width = `${cWidth}px`;
    canvas.style.height = `${cHeight}px`;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cWidth, cHeight);

    // Compute fitted image destination inside canvas viewport
    const imgNaturalW = (rotation === 90 || rotation === 270) ? img.height : img.width;
    const imgNaturalH = (rotation === 90 || rotation === 270) ? img.width : img.height;
    const fitScale = Math.min(
      (cWidth * 0.9) / imgNaturalW,
      (cHeight * 0.9) / imgNaturalH
    );

    const displayW = imgNaturalW * fitScale * zoom;
    const displayH = imgNaturalH * fitScale * zoom;
    const displayX = (cWidth - displayW) / 2;
    const displayY = (cHeight - displayH) / 2;

    // 1. Draw base background grid (transparency pattern)
    ctx.fillStyle = '#0e0e12';
    ctx.fillRect(0, 0, cWidth, cHeight);

    // Subtle dark dot matrix
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    for (let x = 8; x < cWidth; x += 20) {
      for (let y = 8; y < cHeight; y += 20) {
        ctx.fillRect(x, y, 1.5, 1.5);
      }
    }

    // 2. Draw transformed source image
    ctx.save();
    ctx.translate(cWidth / 2, cHeight / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    if (isFlippedH) {
      ctx.scale(-1, 1);
    }
    const drawW = img.width * fitScale * zoom;
    const drawH = img.height * fitScale * zoom;
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    // 3. Compute screen pixels of Crop Rect
    const cropScreenX = displayX + cropBox.x * displayW;
    const cropScreenY = displayY + cropBox.y * displayH;
    const cropScreenW = cropBox.w * displayW;
    const cropScreenH = cropBox.h * displayH;

    // 4. Draw Dark Scrim (Mask) outside the crop box
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    // Top
    ctx.fillRect(0, 0, cWidth, cropScreenY);
    // Bottom
    ctx.fillRect(0, cropScreenY + cropScreenH, cWidth, cHeight - (cropScreenY + cropScreenH));
    // Left
    ctx.fillRect(0, cropScreenY, cropScreenX, cropScreenH);
    // Right
    ctx.fillRect(
      cropScreenX + cropScreenW,
      cropScreenY,
      cWidth - (cropScreenX + cropScreenW),
      cropScreenH
    );

    // 5. Draw Crop Boundary Border (Flick Neon Green)
    ctx.strokeStyle = '#00ff66';
    ctx.lineWidth = 2;
    ctx.strokeRect(cropScreenX, cropScreenY, cropScreenW, cropScreenH);

    // 6. Draw 3x3 Rule-of-Thirds Grid inside Crop Box
    ctx.strokeStyle = 'rgba(0, 255, 102, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    // Vertical third lines
    ctx.beginPath();
    ctx.moveTo(cropScreenX + cropScreenW / 3, cropScreenY);
    ctx.lineTo(cropScreenX + cropScreenW / 3, cropScreenY + cropScreenH);
    ctx.moveTo(cropScreenX + (cropScreenW * 2) / 3, cropScreenY);
    ctx.lineTo(cropScreenX + (cropScreenW * 2) / 3, cropScreenY + cropScreenH);

    // Horizontal third lines
    ctx.moveTo(cropScreenX, cropScreenY + cropScreenH / 3);
    ctx.lineTo(cropScreenX + cropScreenW, cropScreenY + cropScreenH / 3);
    ctx.moveTo(cropScreenX, cropScreenY + (cropScreenH * 2) / 3);
    ctx.lineTo(cropScreenX + cropScreenW, cropScreenY + (cropScreenH * 2) / 3);
    ctx.stroke();
    ctx.setLineDash([]); // Reset line dash

    // 7. Draw 8 Interactive Resize Handles
    const handleSize = 8;
    ctx.fillStyle = '#00ff66';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;

    const handles = [
      // Corners
      { x: cropScreenX, y: cropScreenY },
      { x: cropScreenX + cropScreenW, y: cropScreenY },
      { x: cropScreenX + cropScreenW, y: cropScreenY + cropScreenH },
      { x: cropScreenX, y: cropScreenY + cropScreenH },
      // Edges
      { x: cropScreenX + cropScreenW / 2, y: cropScreenY },
      { x: cropScreenX + cropScreenW, y: cropScreenY + cropScreenH / 2 },
      { x: cropScreenX + cropScreenW / 2, y: cropScreenY + cropScreenH },
      { x: cropScreenX, y: cropScreenY + cropScreenH / 2 }
    ];

    handles.forEach((h) => {
      ctx.beginPath();
      ctx.rect(
        h.x - handleSize / 2,
        h.y - handleSize / 2,
        handleSize,
        handleSize
      );
      ctx.fill();
      ctx.stroke();
    });

    ctx.restore();
  }, [imageLoaded, zoom, rotation, isFlippedH, cropBox]);

  // Redraw when parameters update
  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // ResizeObserver on canvas container
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      drawCanvas();
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [drawCanvas]);

  // Hit test mouse coordinate against crop box and handles
  const getHitHandle = (
    clientX: number,
    clientY: number
  ): 'none' | 'move' | 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w' => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const img = imgRef.current;
    if (!canvas || !container || !img) return 'none';

    const rect = canvas.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;

    const cWidth = container.clientWidth || 600;
    const cHeight = Math.min(480, Math.max(320, container.clientHeight || 420));
    const imgNaturalW = (rotation === 90 || rotation === 270) ? img.height : img.width;
    const imgNaturalH = (rotation === 90 || rotation === 270) ? img.width : img.height;
    const fitScale = Math.min((cWidth * 0.9) / imgNaturalW, (cHeight * 0.9) / imgNaturalH);

    const displayW = imgNaturalW * fitScale * zoom;
    const displayH = imgNaturalH * fitScale * zoom;
    const displayX = (cWidth - displayW) / 2;
    const displayY = (cHeight - displayH) / 2;

    const cropScreenX = displayX + cropBox.x * displayW;
    const cropScreenY = displayY + cropBox.y * displayH;
    const cropScreenW = cropBox.w * displayW;
    const cropScreenH = cropBox.h * displayH;

    const hitRadius = 14;

    // Corner checks
    if (Math.hypot(mouseX - cropScreenX, mouseY - cropScreenY) < hitRadius) return 'nw';
    if (Math.hypot(mouseX - (cropScreenX + cropScreenW), mouseY - cropScreenY) < hitRadius) return 'ne';
    if (Math.hypot(mouseX - (cropScreenX + cropScreenW), mouseY - (cropScreenY + cropScreenH)) < hitRadius) return 'se';
    if (Math.hypot(mouseX - cropScreenX, mouseY - (cropScreenY + cropScreenH)) < hitRadius) return 'sw';

    // Edge checks
    if (Math.abs(mouseY - cropScreenY) < hitRadius && mouseX >= cropScreenX && mouseX <= cropScreenX + cropScreenW) return 'n';
    if (Math.abs(mouseX - (cropScreenX + cropScreenW)) < hitRadius && mouseY >= cropScreenY && mouseY <= cropScreenY + cropScreenH) return 'e';
    if (Math.abs(mouseY - (cropScreenY + cropScreenH)) < hitRadius && mouseX >= cropScreenX && mouseX <= cropScreenX + cropScreenW) return 's';
    if (Math.abs(mouseX - cropScreenX) < hitRadius && mouseY >= cropScreenY && mouseY <= cropScreenY + cropScreenH) return 'w';

    // Inside rect: move entire crop frame
    if (
      mouseX >= cropScreenX &&
      mouseX <= cropScreenX + cropScreenW &&
      mouseY >= cropScreenY &&
      mouseY <= cropScreenY + cropScreenH
    ) {
      return 'move';
    }

    return 'none';
  };

  // Mouse & Touch Interaction Handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    const handle = getHitHandle(e.clientX, e.clientY);
    if (handle !== 'none') {
      dragModeRef.current = handle;
      dragStartPosRef.current = { clientX: e.clientX, clientY: e.clientY };
      initialCropBoxRef.current = { ...cropBox };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const img = imgRef.current;

    // Cursor update when hovering
    if (dragModeRef.current === 'none') {
      const hoverHandle = getHitHandle(e.clientX, e.clientY);
      if (hoverHandle === 'nw' || hoverHandle === 'se') canvas!.style.cursor = 'nwse-resize';
      else if (hoverHandle === 'ne' || hoverHandle === 'sw') canvas!.style.cursor = 'nesw-resize';
      else if (hoverHandle === 'n' || hoverHandle === 's') canvas!.style.cursor = 'ns-resize';
      else if (hoverHandle === 'e' || hoverHandle === 'w') canvas!.style.cursor = 'ew-resize';
      else if (hoverHandle === 'move') canvas!.style.cursor = 'grab';
      else canvas!.style.cursor = 'default';
      return;
    }

    if (!canvas || !container || !img) return;

    const cWidth = container.clientWidth || 600;
    const cHeight = Math.min(480, Math.max(320, container.clientHeight || 420));
    const imgNaturalW = (rotation === 90 || rotation === 270) ? img.height : img.width;
    const imgNaturalH = (rotation === 90 || rotation === 270) ? img.width : img.height;
    const fitScale = Math.min((cWidth * 0.9) / imgNaturalW, (cHeight * 0.9) / imgNaturalH);

    const displayW = imgNaturalW * fitScale * zoom;
    const displayH = imgNaturalH * fitScale * zoom;

    const deltaX = (e.clientX - dragStartPosRef.current.clientX) / displayW;
    const deltaY = (e.clientY - dragStartPosRef.current.clientY) / displayH;

    const init = initialCropBoxRef.current;
    const mode = dragModeRef.current;

    if (mode === 'move') {
      const nextX = Math.max(0, Math.min(1 - init.w, init.x + deltaX));
      const nextY = Math.max(0, Math.min(1 - init.h, init.y + deltaY));
      setCropBox({
        x: nextX,
        y: nextY,
        w: init.w,
        h: init.h
      });
      return;
    }

    // Resizing logic with optional aspect ratio preservation
    const preset = ASPECT_PRESETS.find((p) => p.id === selectedRatioId);
    let targetRatio = preset ? preset.ratio : null;
    if (selectedRatioId === 'device') targetRatio = getDeviceRatio();

    const minSize = 0.08;
    let newX = init.x;
    let newY = init.y;
    let newW = init.w;
    let newH = init.h;

    // Corner adjustments
    if (mode === 'se') {
      newW = Math.max(minSize, Math.min(1 - init.x, init.w + deltaX));
      newH = Math.max(minSize, Math.min(1 - init.y, init.h + deltaY));
    } else if (mode === 'sw') {
      const attemptedW = init.w - deltaX;
      if (attemptedW >= minSize && init.x + deltaX >= 0) {
        newX = init.x + deltaX;
        newW = attemptedW;
      }
      newH = Math.max(minSize, Math.min(1 - init.y, init.h + deltaY));
    } else if (mode === 'ne') {
      newW = Math.max(minSize, Math.min(1 - init.x, init.w + deltaX));
      const attemptedH = init.h - deltaY;
      if (attemptedH >= minSize && init.y + deltaY >= 0) {
        newY = init.y + deltaY;
        newH = attemptedH;
      }
    } else if (mode === 'nw') {
      const attemptedW = init.w - deltaX;
      const attemptedH = init.h - deltaY;
      if (attemptedW >= minSize && init.x + deltaX >= 0) {
        newX = init.x + deltaX;
        newW = attemptedW;
      }
      if (attemptedH >= minSize && init.y + deltaY >= 0) {
        newY = init.y + deltaY;
        newH = attemptedH;
      }
    } else if (mode === 'e') {
      newW = Math.max(minSize, Math.min(1 - init.x, init.w + deltaX));
    } else if (mode === 'w') {
      const attemptedW = init.w - deltaX;
      if (attemptedW >= minSize && init.x + deltaX >= 0) {
        newX = init.x + deltaX;
        newW = attemptedW;
      }
    } else if (mode === 's') {
      newH = Math.max(minSize, Math.min(1 - init.y, init.h + deltaY));
    } else if (mode === 'n') {
      const attemptedH = init.h - deltaY;
      if (attemptedH >= minSize && init.y + deltaY >= 0) {
        newY = init.y + deltaY;
        newH = attemptedH;
      }
    }

    // If a fixed aspect ratio is active, preserve it
    if (targetRatio !== null) {
      const imageRatio = imgNaturalW / imgNaturalH;
      const requiredNormalizedRatio = targetRatio / imageRatio;
      newH = newW / requiredNormalizedRatio;

      if (newY + newH > 1) {
        newH = 1 - newY;
        newW = newH * requiredNormalizedRatio;
      }
    }

    setCropBox({
      x: Math.max(0, Math.min(1 - newW, newX)),
      y: Math.max(0, Math.min(1 - newH, newY)),
      w: Math.max(minSize, Math.min(1, newW)),
      h: Math.max(minSize, Math.min(1, newH))
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    dragModeRef.current = 'none';
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (err) {
      // Ignored if not captured
    }
  };

  // Perform the high-resolution crop export
  const handlePerformCrop = async () => {
    const img = imgRef.current;
    if (!img || !imageLoaded) return;

    setIsProcessing(true);

    try {
      // Create off-screen canvas at full original resolution
      const offscreen = document.createElement('canvas');
      const ctx = offscreen.getContext('2d');
      if (!ctx) throw new Error('Offscreen canvas context failed');

      // 1. Prepare master rotated/flipped canvas
      const masterCanvas = document.createElement('canvas');
      const masterCtx = masterCanvas.getContext('2d');
      if (!masterCtx) throw new Error('Master canvas context failed');

      const isRotatedQuarter = rotation === 90 || rotation === 270;
      const masterW = isRotatedQuarter ? img.height : img.width;
      const masterH = isRotatedQuarter ? img.width : img.height;

      masterCanvas.width = masterW;
      masterCanvas.height = masterH;

      masterCtx.save();
      masterCtx.translate(masterW / 2, masterH / 2);
      masterCtx.rotate((rotation * Math.PI) / 180);
      if (isFlippedH) {
        masterCtx.scale(-1, 1);
      }
      masterCtx.drawImage(img, -img.width / 2, -img.height / 2);
      masterCtx.restore();

      // 2. Slice the crop rectangle
      const sourceCropX = Math.round(cropBox.x * masterW);
      const sourceCropY = Math.round(cropBox.y * masterH);
      const sourceCropW = Math.round(cropBox.w * masterW);
      const sourceCropH = Math.round(cropBox.h * masterH);

      // Max dimension cap for performance (e.g. 2560px) while maintaining crisp detail
      const maxDim = 2560;
      let targetW = sourceCropW;
      let targetH = sourceCropH;

      if (targetW > maxDim || targetH > maxDim) {
        if (targetW >= targetH) {
          targetH = Math.round((targetH * maxDim) / targetW);
          targetW = maxDim;
        } else {
          targetW = Math.round((targetW * maxDim) / targetH);
          targetH = maxDim;
        }
      }

      offscreen.width = Math.max(1, targetW);
      offscreen.height = Math.max(1, targetH);

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      ctx.drawImage(
        masterCanvas,
        sourceCropX,
        sourceCropY,
        sourceCropW,
        sourceCropH,
        0,
        0,
        targetW,
        targetH
      );

      // 3. Convert to Data URL & binary Blob
      const croppedDataUrl = offscreen.toDataURL('image/jpeg', 0.92);

      // Calculate perceived luminance of the newly cropped wallpaper region
      const lum = await analyzeImageBrightness(croppedDataUrl);

      const blob = await new Promise<Blob>((resolve, reject) => {
        offscreen.toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error('Failed to create cropped image blob.'));
          },
          'image/jpeg',
          0.92
        );
      });

      const preset = ASPECT_PRESETS.find((p) => p.id === selectedRatioId);
      const ratioLabel = preset ? preset.label : 'Custom Aspect Ratio';

      onApplyCrop({
        dataUrl: croppedDataUrl,
        blob,
        aspectRatioLabel: ratioLabel,
        luminance: lum,
        width: targetW,
        height: targetH
      });
    } catch (err: any) {
      console.error('[Crop Error]', err);
      setImageError(err.message || 'Crop processing failed.');
      setIsProcessing(false);
    }
  };

  // Dimension estimation readout
  const estimatedPixelWidth = imgRef.current
    ? Math.round(
        cropBox.w *
          ((rotation === 90 || rotation === 270)
            ? imgRef.current.height
            : imgRef.current.width)
      )
    : 1920;
  const estimatedPixelHeight = imgRef.current
    ? Math.round(
        cropBox.h *
          ((rotation === 90 || rotation === 270)
            ? imgRef.current.width
            : imgRef.current.height)
      )
    : 1080;

  return (
    <div className="flex flex-col h-full bg-zinc-950 font-mono text-zinc-100 select-none">
      {/* Top Header Bar */}
      <div className="px-4 py-3 border-b border-zinc-850 flex items-center justify-between shrink-0 bg-zinc-900/90">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[var(--neon-green)]/15 border border-[var(--neon-green)]/40 flex items-center justify-center text-[var(--neon-green)]">
            <Crop className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase text-white tracking-wider">
              Canvas Image Cropper
            </h3>
            <p className="text-[8px] text-zinc-400">
              Aspect-ratio fit wallpaper for all screen resolutions
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition cursor-pointer"
          title="Close Cropper"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Interactive Stage */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        {/* Canvas Workspace */}
        <div
          ref={containerRef}
          className="flex-1 bg-black/95 relative flex items-center justify-center p-2 sm:p-4 overflow-hidden touch-none"
        >
          {imageError ? (
            <div className="text-center p-6 bg-rose-950/40 border border-rose-800 rounded-xl max-w-sm">
              <p className="text-[10px] font-bold text-rose-300">{imageError}</p>
              <button
                type="button"
                onClick={onCancel}
                className="mt-3 px-3 py-1.5 bg-zinc-800 text-xs rounded uppercase font-bold"
              >
                Go Back
              </button>
            </div>
          ) : !imageLoaded ? (
            <div className="flex flex-col items-center gap-2 text-zinc-400">
              <div className="w-6 h-6 border-2 border-[var(--neon-green)] border-t-transparent rounded-full animate-spin" />
              <span className="text-[9px] uppercase tracking-wider">
                Loading Master Image...
              </span>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              id="wallpaper-cropper-canvas"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="rounded-lg shadow-2xl border border-zinc-800"
            />
          )}

          {/* Floating Canvas Overlays: Pixel Readout & Quick Hint */}
          {imageLoaded && (
            <div className="absolute top-4 left-4 z-10 flex flex-col gap-1 pointer-events-none">
              <div className="px-2 py-1 rounded bg-black/80 backdrop-blur-md border border-zinc-800 text-[8.5px] font-mono font-bold text-[var(--neon-green)] flex items-center gap-1.5 shadow-lg">
                <Layers className="w-3 h-3 text-[var(--neon-green)]" />
                <span>
                  {estimatedPixelWidth} × {estimatedPixelHeight} px
                </span>
                <span className="text-zinc-400">
                  (
                  {selectedRatioId === 'device'
                    ? 'Device Match'
                    : selectedRatioId === 'free'
                    ? 'Freeform'
                    : selectedRatioId}
                  )
                </span>
              </div>
            </div>
          )}

          <div className="absolute bottom-4 left-4 right-4 sm:right-auto z-10 pointer-events-none text-center sm:text-left">
            <span className="px-2.5 py-1 rounded bg-black/75 backdrop-blur-md border border-zinc-800 text-[7.5px] text-zinc-400">
              💡 Drag box to position · Drag handles to resize · Zoom below
            </span>
          </div>
        </div>

        {/* Sidebar Controls: Aspect Ratios & Tools */}
        <div className="w-full md:w-80 bg-zinc-900/70 border-t md:border-t-0 md:border-l border-zinc-850 flex flex-col justify-between shrink-0 overflow-y-auto p-3 sm:p-4 space-y-4">
          <div className="space-y-4">
            {/* Screen Size / Aspect Ratio Presets */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] uppercase font-bold text-zinc-400 tracking-wider">
                  Target Screen Size / Ratio:
                </span>
                <span className="text-[8px] text-[var(--neon-green)] font-bold">
                  {selectedRatioId.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {ASPECT_PRESETS.map((preset) => {
                  const Icon = preset.icon;
                  const isActive = selectedRatioId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyAspectRatio(preset.id)}
                      className={`p-2 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                        isActive
                          ? 'border-[var(--neon-green)] bg-[var(--neon-green)]/15 text-white ring-1 ring-[var(--neon-green)]'
                          : 'border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                      }`}
                      title={preset.description}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[var(--neon-green)]' : 'text-zinc-500'}`} />
                        <span className="text-[8.5px] font-bold truncate">
                          {preset.label}
                        </span>
                      </div>
                      {isActive && (
                        <Check className="w-3 h-3 text-[var(--neon-green)] shrink-0 ml-1" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Transform Controls (Zoom, Rotate, Flip) */}
            <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-850 space-y-3">
              <span className="text-[9px] uppercase font-bold text-zinc-400 tracking-wider block">
                Adjust & Scale
              </span>

              {/* Zoom Slider */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[8px] text-zinc-400">
                  <span className="flex items-center gap-1">
                    <ZoomIn className="w-3 h-3 text-zinc-500" /> Zoom Level
                  </span>
                  <span className="text-white font-bold">{Math.round(zoom * 100)}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.max(0.6, Number((z - 0.1).toFixed(2))))}
                    className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs cursor-pointer"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-3 h-3" />
                  </button>
                  <input
                    type="range"
                    min="0.6"
                    max="2.5"
                    step="0.05"
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="w-full accent-[var(--neon-green)] bg-zinc-800 h-1 rounded-lg appearance-none cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.min(2.5, Number((z + 0.1).toFixed(2))))}
                    className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs cursor-pointer"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Rotation & Flip Actions */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-850">
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="px-2 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-900 text-zinc-300 hover:text-white text-[8px] uppercase font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <RotateCw className="w-3 h-3 text-[var(--neon-green)]" />
                  <span>Rotate 90°</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsFlippedH((f) => !f)}
                  className={`px-2 py-1.5 rounded-lg border text-[8px] uppercase font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    isFlippedH
                      ? 'border-[var(--neon-green)] bg-[var(--neon-green)]/15 text-white'
                      : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900 text-zinc-300 hover:text-white'
                  }`}
                >
                  <FlipHorizontal className="w-3 h-3 text-[var(--neon-green)]" />
                  <span>Flip H</span>
                </button>
              </div>

              {/* Reset Crop to Defaults */}
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setRotation(0);
                  setIsFlippedH(false);
                  applyAspectRatio(selectedRatioId);
                }}
                className="w-full py-1 text-[7.5px] uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition flex items-center justify-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>Reset Crop & Orientation</span>
              </button>
            </div>
          </div>

          {/* Action Confirmation Buttons */}
          <div className="pt-2 border-t border-zinc-850 space-y-2">
            <button
              type="button"
              disabled={isProcessing || !imageLoaded}
              onClick={handlePerformCrop}
              className="w-full py-2.5 bg-[var(--neon-green)] hover:bg-white text-black font-black rounded-xl text-[9.5px] uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Rendering Crop...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Apply Crop & Continue</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onCancel}
              className="w-full py-1.5 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white text-[8.5px] font-bold uppercase transition cursor-pointer text-center"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
