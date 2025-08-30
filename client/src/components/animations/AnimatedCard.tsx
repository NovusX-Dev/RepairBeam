import { motion } from 'framer-motion';
import { ReactNode, forwardRef } from 'react';
import { Card } from '@/components/ui/card';
import { HOVER_VARIANTS, ANIMATION_VARIANTS, TRANSITION_CONFIGS, shouldAnimate } from '@/lib/animations';
import { cn } from '@/lib/utils';

type HoverVariant = keyof typeof HOVER_VARIANTS;
type EntranceVariant = keyof typeof ANIMATION_VARIANTS;

interface AnimatedCardProps {
  children: ReactNode;
  hoverVariant?: HoverVariant;
  entranceVariant?: EntranceVariant;
  delay?: number;
  disabled?: boolean;
  className?: string;
}

export const AnimatedCard = forwardRef<HTMLDivElement, AnimatedCardProps>(
  ({ 
    children, 
    hoverVariant = 'lift',
    entranceVariant = 'fadeInUp',
    delay = 0,
    disabled = false,
    className
  }, ref) => {
    if (!shouldAnimate() || disabled) {
      return (
        <Card ref={ref} className={className}>
          {children}
        </Card>
      );
    }

    const hoverAnimation = HOVER_VARIANTS[hoverVariant];
    const entranceAnimation = ANIMATION_VARIANTS[entranceVariant];

    return (
      <motion.div
        variants={entranceAnimation}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ ...TRANSITION_CONFIGS.normal, delay }}
      >
        <motion.div
          variants={hoverAnimation}
          initial="rest"
          whileHover="hover"
          whileTap="tap"
          transition={TRANSITION_CONFIGS.fast}
        >
          <Card
            ref={ref}
            className={cn('cursor-pointer', className)}
          >
            {children}
          </Card>
        </motion.div>
      </motion.div>
    );
  }
);

AnimatedCard.displayName = 'AnimatedCard';