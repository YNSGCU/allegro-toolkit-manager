import { useEffect, useRef, useState } from 'react';
import type { ResponsiveScaleConfig } from './responsiveScale';
import { computeResponsiveScale } from './responsiveScale';

export function useResponsiveScale<T extends HTMLElement>(
  config: ResponsiveScaleConfig,
) {
  const elementRef = useRef<T | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return;
    }

    const updateScale = () => {
      setScale(
        computeResponsiveScale(
          element.clientWidth,
          element.clientHeight,
          config,
        ),
      );
    };

    updateScale();

    const observer = new ResizeObserver(() => {
      updateScale();
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [config]);

  return { elementRef, scale };
}
