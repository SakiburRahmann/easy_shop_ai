'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';

/**
 * Reveals content *once*, when it first scrolls into view.
 *
 * Visible is the default state. Script only adds `.es-pending` to elements
 * that start below the fold, then removes it on intersection. This means a
 * stalled transition, a background tab, or no JavaScript at all leaves the
 * content readable rather than clipped.
 *
 * Deliberately used on a few structural moments per template — a fade on
 * every element is itself a generated-page tell.
 */
export function Reveal({
  children,
  as: Tag = 'div',
  className = '',
  delay = 0,
  variant = 'rise',
}: {
  children: ReactNode;
  as?: 'div' | 'section' | 'figure' | 'li' | 'header';
  className?: string;
  delay?: number;
  variant?: 'rise' | 'unveil';
}) {
  const ref = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Already on screen on first paint: show it, don't animate the first view.
    if (typeof IntersectionObserver === 'undefined') return;
    if (node.getBoundingClientRect().top < window.innerHeight) return;

    node.classList.add('es-pending');

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            node.classList.remove('es-pending');
            observer.disconnect();
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    );
    observer.observe(node);

    // Failsafe: never leave a section hidden if the observer never fires.
    const failsafe = window.setTimeout(() => node.classList.remove('es-pending'), 3000);

    return () => {
      observer.disconnect();
      clearTimeout(failsafe);
    };
  }, []);

  return (
    <Tag
      ref={ref as never}
      className={`${variant === 'unveil' ? 'es-unveil' : 'es-reveal'} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
