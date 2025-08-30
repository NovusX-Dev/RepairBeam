import { motion } from 'framer-motion';
import { ReactNode, forwardRef } from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import { HOVER_VARIANTS, TRANSITION_CONFIGS, shouldAnimate } from '@/lib/animations';
import { cn } from '@/lib/utils';

type HoverVariant = keyof typeof HOVER_VARIANTS;

interface AnimatedButtonProps extends ButtonProps {
  children: ReactNode;
  hoverVariant?: HoverVariant;
  disabled?: boolean;
  loading?: boolean;
}

export const AnimatedButton = forwardRef<HTMLButtonElement, AnimatedButtonProps>(
  ({ 
    children, 
    hoverVariant = 'lift',
    disabled = false,
    loading = false,
    className,
    ...buttonProps 
  }, ref) => {
    const shouldApplyAnimation = shouldAnimate() && !disabled && !loading;
    
    if (!shouldApplyAnimation) {
      return (
        <Button
          ref={ref}
          className={className}
          disabled={disabled || loading}
          {...buttonProps}
        >
          {loading && (
            <motion.div
              className="w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          )}
          {children}
        </Button>
      );
    }

    const hoverAnimation = HOVER_VARIANTS[hoverVariant];

    return (
      <motion.div
        variants={hoverAnimation}
        initial="rest"
        whileHover="hover"
        whileTap="tap"
        transition={TRANSITION_CONFIGS.fast}
      >
        <Button
          ref={ref}
          className={cn('relative overflow-hidden', className)}
          disabled={disabled || loading}
          {...buttonProps}
        >
          {loading && (
            <motion.div
              className="w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          )}
          {hoverVariant === 'shimmer' && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
              variants={HOVER_VARIANTS.shimmer}
              transition={{ duration: 0.6 }}
            />
          )}
          {children}
        </Button>
      </motion.div>
    );
  }
);

AnimatedButton.displayName = 'AnimatedButton';