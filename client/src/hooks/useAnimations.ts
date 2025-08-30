import { useEffect, useRef, useState } from 'react';
import { useAnimation, AnimationControls, Transition } from 'framer-motion';
import { 
  shouldAnimate, 
  ANIMATION_VARIANTS, 
  TRANSITION_CONFIGS,
  HOVER_VARIANTS,
  applyAnimation,
  ANIMATION_DURATIONS 
} from '@/lib/animations';

// Hook for controlling animations programmatically
export function useAnimationControls() {
  const controls = useAnimation();
  const isAnimationEnabled = shouldAnimate();

  const playAnimation = async (
    variant: keyof typeof ANIMATION_VARIANTS,
    transitionConfig: keyof typeof TRANSITION_CONFIGS = 'normal'
  ) => {
    if (!isAnimationEnabled) return;
    
    const animation = ANIMATION_VARIANTS[variant];
    const transition = TRANSITION_CONFIGS[transitionConfig] as Transition;
    
    return controls.start(animation.animate as any, transition);
  };

  const stopAnimation = () => {
    controls.stop();
  };

  const resetAnimation = async (variant: keyof typeof ANIMATION_VARIANTS) => {
    if (!isAnimationEnabled) return;
    
    const animation = ANIMATION_VARIANTS[variant];
    if ('initial' in animation) {
      return controls.set(animation.initial as any);
    }
  };

  return {
    controls,
    playAnimation,
    stopAnimation,
    resetAnimation,
    isEnabled: isAnimationEnabled,
  };
}

// Hook for entrance animations with intersection observer
export function useEntranceAnimation(
  variant: keyof typeof ANIMATION_VARIANTS = 'fadeInUp',
  threshold: number = 0.1,
  triggerOnce: boolean = true
) {
  const ref = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const controls = useAnimation();

  useEffect(() => {
    if (!shouldAnimate()) return;

    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          const animation = ANIMATION_VARIANTS[variant];
          controls.start(animation.animate as any);
          
          if (triggerOnce) {
            observer.unobserve(element);
          }
        } else if (!triggerOnce) {
          setIsVisible(false);
          const animation = ANIMATION_VARIANTS[variant];
          if ('initial' in animation) {
            controls.start(animation.initial as any);
          }
        }
      },
      { threshold }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [variant, threshold, triggerOnce, controls]);

  return {
    ref,
    isVisible,
    controls,
    animate: shouldAnimate() ? controls : undefined,
  };
}

// Hook for hover animations
export function useHoverAnimation(hoverVariant: keyof typeof HOVER_VARIANTS = 'lift') {
  const controls = useAnimation();
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = () => {
    if (!shouldAnimate()) return;
    setIsHovered(true);
    const animation = HOVER_VARIANTS[hoverVariant];
    controls.start(animation.hover as any);
  };

  const handleMouseLeave = () => {
    if (!shouldAnimate()) return;
    setIsHovered(false);
    const animation = HOVER_VARIANTS[hoverVariant];
    controls.start(animation.rest as any);
  };

  return {
    controls,
    isHovered,
    hoverProps: {
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
    },
  };
}

// Hook for sequential animations
export function useSequentialAnimation() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const playSequence = async (
    animations: Array<{
      variant: keyof typeof ANIMATION_VARIANTS;
      duration?: number;
      delay?: number;
    }>
  ) => {
    if (!shouldAnimate()) return;
    
    setIsPlaying(true);
    setCurrentStep(0);

    for (let i = 0; i < animations.length; i++) {
      const { variant, duration = ANIMATION_DURATIONS.normal, delay = 0 } = animations[i];
      
      setCurrentStep(i);
      
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      await new Promise(resolve => setTimeout(resolve, duration));
    }

    setIsPlaying(false);
    setCurrentStep(0);
  };

  return {
    currentStep,
    isPlaying,
    playSequence,
  };
}

// Hook for scroll-triggered animations
export function useScrollAnimation(
  trigger: 'top' | 'center' | 'bottom' = 'center',
  offset: number = 0
) {
  const ref = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);
  const controls = useAnimation();

  useEffect(() => {
    if (!shouldAnimate()) return;

    const element = ref.current;
    if (!element) return;

    const handleScroll = () => {
      const rect = element.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      
      let triggerPoint: number;
      switch (trigger) {
        case 'top':
          triggerPoint = rect.top + offset;
          break;
        case 'bottom':
          triggerPoint = rect.bottom + offset;
          break;
        default: // center
          triggerPoint = rect.top + rect.height / 2 + offset;
      }

      const scrollProgress = Math.max(0, Math.min(1, 
        (windowHeight - triggerPoint) / windowHeight
      ));
      
      setProgress(scrollProgress);
      
      // Trigger animations based on scroll progress
      if (scrollProgress > 0.1) {
        controls.start({ opacity: 1, y: 0 });
      } else {
        controls.start({ opacity: 0, y: 20 });
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check

    return () => window.removeEventListener('scroll', handleScroll);
  }, [trigger, offset, controls]);

  return {
    ref,
    progress,
    controls,
  };
}

// Hook for CSS-based animations (fallback for complex scenarios)
export function useCSSAnimation() {
  const ref = useRef<HTMLElement>(null);

  const playCSS = async (
    animationName: string,
    duration: number = ANIMATION_DURATIONS.normal,
    easing: string = 'ease-out'
  ) => {
    const element = ref.current;
    if (!element || !shouldAnimate()) return;

    return applyAnimation(element, animationName, duration, easing);
  };

  return {
    ref,
    playCSS,
  };
}