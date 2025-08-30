// Animation utilities and constants for micro-interactions
export const ANIMATION_DURATIONS = {
  fastest: 150,
  fast: 200,
  normal: 300,
  slow: 500,
  slowest: 800,
} as const;

export const ANIMATION_EASINGS = {
  easeOut: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  easeIn: 'cubic-bezier(0.55, 0.085, 0.68, 0.53)',
  easeInOut: 'cubic-bezier(0.455, 0.03, 0.515, 0.955)',
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  elastic: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

export const ANIMATION_VARIANTS = {
  // Fade animations
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  fadeInUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  },
  fadeInDown: {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 20 },
  },
  fadeInLeft: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
  },
  fadeInRight: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  },

  // Scale animations
  scaleIn: {
    initial: { opacity: 0, scale: 0.8 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.8 },
  },
  scaleInBounce: {
    initial: { opacity: 0, scale: 0.3 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.3 },
  },
  pulse: {
    initial: { scale: 1 },
    animate: { scale: [1, 1.05, 1] as number[] },
    exit: { scale: 1 },
  },

  // Slide animations
  slideInUp: {
    initial: { y: '100%' },
    animate: { y: 0 },
    exit: { y: '100%' },
  },
  slideInDown: {
    initial: { y: '-100%' },
    animate: { y: 0 },
    exit: { y: '-100%' },
  },
  slideInLeft: {
    initial: { x: '-100%' },
    animate: { x: 0 },
    exit: { x: '-100%' },
  },
  slideInRight: {
    initial: { x: '100%' },
    animate: { x: 0 },
    exit: { x: '100%' },
  },

  // Rotation animations
  rotateIn: {
    initial: { opacity: 0, rotate: -180 },
    animate: { opacity: 1, rotate: 0 },
    exit: { opacity: 0, rotate: 180 },
  },
  flipIn: {
    initial: { opacity: 0, rotateY: -90 },
    animate: { opacity: 1, rotateY: 0 },
    exit: { opacity: 0, rotateY: 90 },
  },

  // Loading animations
  spin: {
    animate: { rotate: 360 },
  },
  breathe: {
    animate: { scale: [1, 1.1, 1] as number[] },
  },
  float: {
    animate: { y: [0, -10, 0] as number[] },
  },

  // Attention seekers
  shake: {
    animate: { x: [0, -10, 10, -10, 10, 0] as number[] },
  },
  wobble: {
    animate: { 
      x: [0, -25, 20, -15, 10, -5, 0] as number[],
      rotate: [0, -5, 3, -3, 2, -1, 0] as number[],
    },
  },
  bounce: {
    animate: { 
      y: [0, -30, 0, -15, 0, -7, 0] as number[],
      scaleX: [1, 1.1, 1, 1.05, 1, 1.02, 1] as number[],
      scaleY: [1, 0.9, 1, 0.95, 1, 0.98, 1] as number[],
    },
  },
} as const;

export const TRANSITION_CONFIGS = {
  fast: {
    duration: ANIMATION_DURATIONS.fast / 1000,
    ease: ANIMATION_EASINGS.easeOut,
  },
  normal: {
    duration: ANIMATION_DURATIONS.normal / 1000,
    ease: ANIMATION_EASINGS.easeInOut,
  },
  slow: {
    duration: ANIMATION_DURATIONS.slow / 1000,
    ease: ANIMATION_EASINGS.easeOut,
  },
  bounce: {
    duration: ANIMATION_DURATIONS.slow / 1000,
    ease: ANIMATION_EASINGS.bounce,
  },
  elastic: {
    duration: ANIMATION_DURATIONS.slow / 1000,
    ease: ANIMATION_EASINGS.elastic,
  },
  smooth: {
    duration: ANIMATION_DURATIONS.normal / 1000,
    ease: ANIMATION_EASINGS.smooth,
  },
} as const;

// Hover and interaction variants
export const HOVER_VARIANTS = {
  lift: {
    rest: { scale: 1, y: 0 },
    hover: { scale: 1.02, y: -2 },
    tap: { scale: 0.98, y: 0 },
  },
  glow: {
    rest: { boxShadow: '0 0 0 rgba(59, 130, 246, 0)' },
    hover: { boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)' },
  },
  scale: {
    rest: { scale: 1 },
    hover: { scale: 1.05 },
    tap: { scale: 0.95 },
  },
  rotate: {
    rest: { rotate: 0 },
    hover: { rotate: 5 },
  },
  shimmer: {
    rest: { backgroundPosition: '-200% 0' },
    hover: { backgroundPosition: '200% 0' },
  },
} as const;

// Stagger animation utilities
export const STAGGER_CONFIGS = {
  list: {
    animate: {
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.1,
      },
    },
  },
  grid: {
    animate: {
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1,
      },
    },
  },
  cards: {
    animate: {
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  },
} as const;

// CSS-in-JS animation utilities
export const createKeyframes = (name: string, keyframes: Record<string, any>) => {
  const keyframeString = Object.entries(keyframes)
    .map(([percentage, styles]) => {
      const styleString = Object.entries(styles)
        .map(([property, value]) => `${property}: ${value}`)
        .join('; ');
      return `${percentage} { ${styleString} }`;
    })
    .join(' ');
  
  return `@keyframes ${name} { ${keyframeString} }`;
};

export const applyAnimation = (
  element: HTMLElement,
  animationName: string,
  duration: number = ANIMATION_DURATIONS.normal,
  easing: string = ANIMATION_EASINGS.easeOut,
  fillMode: string = 'both'
) => {
  element.style.animation = `${animationName} ${duration}ms ${easing} ${fillMode}`;
  
  return new Promise((resolve) => {
    const onAnimationEnd = () => {
      element.removeEventListener('animationend', onAnimationEnd);
      resolve(void 0);
    };
    element.addEventListener('animationend', onAnimationEnd);
  });
};

// Performance optimization utilities
export const prefersReducedMotion = () => {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

export const shouldAnimate = () => {
  return !prefersReducedMotion();
};

export const getOptimalDuration = (baseDuration: number) => {
  return prefersReducedMotion() ? baseDuration * 0.5 : baseDuration;
};

// Layout animation helpers
export const LAYOUT_TRANSITIONS = {
  smooth: {
    layout: true,
    transition: {
      layout: {
        duration: 0.3,
        ease: ANIMATION_EASINGS.smooth,
      },
    },
  },
  bouncy: {
    layout: true,
    transition: {
      layout: {
        duration: 0.5,
        ease: ANIMATION_EASINGS.bounce,
      },
    },
  },
} as const;