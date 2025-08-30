import { motion, MotionProps, Transition } from 'framer-motion';
import { ReactNode, forwardRef } from 'react';
import { ANIMATION_VARIANTS, TRANSITION_CONFIGS, shouldAnimate } from '@/lib/animations';
import { cn } from '@/lib/utils';

type AnimationVariant = keyof typeof ANIMATION_VARIANTS;
type TransitionConfig = keyof typeof TRANSITION_CONFIGS;

interface AnimatedContainerProps extends Omit<MotionProps, 'variants' | 'initial' | 'animate' | 'exit' | 'transition'> {
  children: ReactNode;
  variant?: AnimationVariant;
  transitionConfig?: TransitionConfig;
  delay?: number;
  duration?: number;
  className?: string;
  disabled?: boolean;
}

export const AnimatedContainer = forwardRef<HTMLDivElement, AnimatedContainerProps>(
  ({ 
    children, 
    variant = 'fadeIn', 
    transitionConfig = 'normal',
    delay = 0,
    duration,
    className,
    disabled = false,
    ...motionProps 
  }, ref) => {
    // Skip animation if user prefers reduced motion or animation is disabled
    if (!shouldAnimate() || disabled) {
      return (
        <div ref={ref} className={className}>
          {children}
        </div>
      );
    }

    const animationVariant = ANIMATION_VARIANTS[variant];
    const transitionSettings: Transition = {
      ...TRANSITION_CONFIGS[transitionConfig],
      delay,
      ...(duration && { duration: duration / 1000 }),
    };

    return (
      <motion.div
        ref={ref}
        className={cn('', className)}
        variants={animationVariant}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={transitionSettings}
        {...motionProps}
      >
        {children}
      </motion.div>
    );
  }
);

AnimatedContainer.displayName = 'AnimatedContainer';