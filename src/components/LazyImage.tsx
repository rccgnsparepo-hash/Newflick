import React, { useState, useEffect, useRef } from 'react';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  blurDataUrl?: string;
  className?: string;
  containerClassName?: string;
  onClick?: (e: React.MouseEvent<HTMLImageElement>) => void;
}

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  blurDataUrl,
  className = '',
  containerClassName = '',
  onClick,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!imgRef.current) return;

    // Use IntersectionObserver to lazy load image when close to viewport
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '200px 0px', // start loading 200px before scrolling into view
        threshold: 0.01
      }
    );

    observer.observe(imgRef.current);

    return () => {
      observer.disconnect();
    };
  }, [src]);

  // SVG default blur-up placeholder background pattern
  const defaultPlaceholder =
    blurDataUrl ||
    'data:image/svg+xml;charset=utf-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%231a1a1a"/%3E%3Cpath d="M0 0l100 100M100 0L0 100" stroke="%23333333" stroke-width="2"/%3E%3C/svg%3E';

  return (
    <div
      ref={imgRef}
      className={`relative overflow-hidden bg-neutral-900 ${containerClassName}`}
    >
      {/* Blur-up Placeholder Layer */}
      {!isLoaded && !hasError && (
        <div
          className="absolute inset-0 bg-cover bg-center filter blur-xl scale-110 transition-opacity duration-500 bg-neutral-800 animate-pulse"
          style={{
            backgroundImage: `url(${defaultPlaceholder})`
          }}
        />
      )}

      {/* Actual Image when in view */}
      {isInView && !hasError && (
        <img
          src={src}
          alt={alt}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          onClick={onClick}
          className={`${className} transition-all duration-500 ease-out ${
            isLoaded
              ? 'opacity-100 blur-0 scale-100'
              : 'opacity-0 blur-md scale-105'
          }`}
          {...props}
        />
      )}

      {/* Error Fallback Layer */}
      {hasError && (
        <div className="flex items-center justify-center p-4 bg-neutral-900 border border-neutral-800 text-zinc-500 text-[10px] uppercase font-mono tracking-wider">
          <span>[ Image Unavailable ]</span>
        </div>
      )}
    </div>
  );
};

export default LazyImage;
