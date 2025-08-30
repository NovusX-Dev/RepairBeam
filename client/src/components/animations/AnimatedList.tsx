import { motion } from 'framer-motion';
import { ReactNode } from 'react';
import { STAGGER_CONFIGS, ANIMATION_VARIANTS, shouldAnimate } from '@/lib/animations';

interface AnimatedListProps {
  children: ReactNode[];
  staggerType?: keyof typeof STAGGER_CONFIGS;
  itemVariant?: keyof typeof ANIMATION_VARIANTS;
  className?: string;
  as?: 'div' | 'ul' | 'ol';
  disabled?: boolean;
}

export function AnimatedList({ 
  children, 
  staggerType = 'list',
  itemVariant = 'fadeInUp',
  className = '',
  as = 'div',
  disabled = false 
}: AnimatedListProps) {
  if (!shouldAnimate() || disabled) {
    const Component = as;
    return (
      <Component className={className}>
        {children}
      </Component>
    );
  }

  const staggerConfig = STAGGER_CONFIGS[staggerType];
  const itemAnimation = ANIMATION_VARIANTS[itemVariant];

  const MotionComponent = motion[as] as any;

  return (
    <MotionComponent
      className={className}
      variants={staggerConfig}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {children.map((child, index) => (
        <motion.div
          key={index}
          variants={itemAnimation}
          layout
        >
          {child}
        </motion.div>
      ))}
    </MotionComponent>
  );
}