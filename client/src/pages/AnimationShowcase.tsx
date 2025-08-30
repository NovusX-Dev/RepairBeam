import { useState } from 'react';
import { AnimatedContainer } from '@/components/animations/AnimatedContainer';
import { AnimatedButton } from '@/components/animations/AnimatedButton';
import { AnimatedCard } from '@/components/animations/AnimatedCard';
import { AnimatedList } from '@/components/animations/AnimatedList';
import { LoadingSpinner } from '@/components/animations/LoadingSpinner';
import { useAnimationControls, useEntranceAnimation } from '@/hooks/useAnimations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLocalization } from '@/contexts/LocalizationContext';
import { Zap, Sparkles, Rocket, Star, Heart, Play, Pause, RotateCcw } from 'lucide-react';

export default function AnimationShowcase() {
  const { t } = useLocalization();
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadingVariant, setLoadingVariant] = useState<'spinner' | 'dots' | 'pulse' | 'bars'>('spinner');
  const { playAnimation, stopAnimation, resetAnimation } = useAnimationControls();
  const { ref: entranceRef } = useEntranceAnimation('fadeInUp', 0.2);

  const animationVariants = [
    'fadeIn', 'fadeInUp', 'fadeInDown', 'fadeInLeft', 'fadeInRight',
    'scaleIn', 'scaleInBounce', 'pulse', 'slideInUp', 'slideInDown',
    'slideInLeft', 'slideInRight', 'rotateIn', 'flipIn'
  ] as const;

  const hoverVariants = [
    'lift', 'glow', 'scale', 'rotate', 'shimmer'
  ] as const;

  const demoItems = [
    { icon: <Zap className="w-5 h-5" />, title: "Lightning Fast", description: "Optimized animations" },
    { icon: <Sparkles className="w-5 h-5" />, title: "Smooth Transitions", description: "Fluid motion design" },
    { icon: <Rocket className="w-5 h-5" />, title: "Performance First", description: "GPU accelerated" },
    { icon: <Star className="w-5 h-5" />, title: "Accessibility", description: "Respects user preferences" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-6">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <AnimatedContainer variant="fadeInDown" className="text-center space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Animation Showcase
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Experience smooth micro-interactions and engaging animations throughout the Repair Beam platform
          </p>
        </AnimatedContainer>

        {/* Button Animations */}
        <AnimatedContainer variant="fadeInUp" delay={0.1}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                Interactive Buttons
              </CardTitle>
              <CardDescription>
                Hover and click buttons to see micro-interactions in action
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {hoverVariants.map((variant) => (
                  <AnimatedButton
                    key={variant}
                    hoverVariant={variant}
                    variant="outline"
                    className="h-16"
                    data-testid={`button-${variant}`}
                  >
                    <div className="text-center">
                      <div className="text-sm font-medium capitalize">{variant}</div>
                      <div className="text-xs text-muted-foreground">Hover me</div>
                    </div>
                  </AnimatedButton>
                ))}
              </div>
            </CardContent>
          </Card>
        </AnimatedContainer>

        {/* Loading Animations */}
        <AnimatedContainer variant="fadeInUp" delay={0.2}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Loading States
              </CardTitle>
              <CardDescription>
                Various loading animations for different contexts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-center gap-4 flex-wrap">
                  {(['spinner', 'dots', 'pulse', 'bars'] as const).map((variant) => (
                    <Button
                      key={variant}
                      variant={loadingVariant === variant ? 'default' : 'outline'}
                      onClick={() => setLoadingVariant(variant)}
                      data-testid={`loading-${variant}-button`}
                    >
                      {variant.charAt(0).toUpperCase() + variant.slice(1)}
                    </Button>
                  ))}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-8">
                  {(['sm', 'md', 'lg', 'xl'] as const).map((size) => (
                    <div key={size} className="text-center space-y-4">
                      <div className="text-sm font-medium text-muted-foreground uppercase">
                        {size}
                      </div>
                      <div className="flex justify-center">
                        <LoadingSpinner 
                          variant={loadingVariant} 
                          size={size}
                          data-testid={`spinner-${size}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </AnimatedContainer>

        {/* Card Animations */}
        <AnimatedContainer variant="fadeInUp" delay={0.3}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-primary" />
                Animated Cards
              </CardTitle>
              <CardDescription>
                Cards with entrance animations and hover effects
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {demoItems.map((item, index) => (
                  <AnimatedCard
                    key={index}
                    hoverVariant="lift"
                    entranceVariant="scaleIn"
                    delay={index * 0.1}
                    className="h-32"
                    data-testid={`demo-card-${index}`}
                  >
                    <CardContent className="p-6 h-full flex flex-col items-center justify-center text-center space-y-2">
                      <div className="text-primary">{item.icon}</div>
                      <div className="font-medium text-sm">{item.title}</div>
                      <div className="text-xs text-muted-foreground">{item.description}</div>
                    </CardContent>
                  </AnimatedCard>
                ))}
              </div>
            </CardContent>
          </Card>
        </AnimatedContainer>

        {/* List Animation */}
        <AnimatedContainer variant="fadeInUp" delay={0.4}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Rocket className="w-5 h-5 text-primary" />
                Staggered Lists
              </CardTitle>
              <CardDescription>
                Items animate in sequence for smooth list reveals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AnimatedList 
                staggerType="list" 
                itemVariant="fadeInLeft"
                className="space-y-3"
              >
                {animationVariants.map((variant, index) => (
                  <div key={variant} className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="font-mono text-xs">
                        {variant}
                      </Badge>
                      <span className="text-sm">Animation variant</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      #{index + 1}
                    </div>
                  </div>
                ))}
              </AnimatedList>
            </CardContent>
          </Card>
        </AnimatedContainer>

        {/* Entrance Animation Demo */}
        <AnimatedContainer variant="fadeInUp" delay={0.5}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="w-5 h-5 text-primary" />
                Scroll-Triggered Animations
              </CardTitle>
              <CardDescription>
                This section animated when it came into view
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div ref={entranceRef as any} className="p-8 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg text-center space-y-4">
                <div className="text-2xl font-bold">🎉 You scrolled here!</div>
                <p className="text-muted-foreground">
                  This content uses intersection observer to trigger animations when elements become visible.
                  Perfect for creating engaging user experiences as users navigate through your application.
                </p>
              </div>
            </CardContent>
          </Card>
        </AnimatedContainer>

        {/* Performance Info */}
        <AnimatedContainer variant="fadeInUp" delay={0.6} className="pb-12">
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="text-center">Performance & Accessibility</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="text-2xl">⚡</div>
                  <div className="font-medium">GPU Accelerated</div>
                  <div className="text-sm text-muted-foreground">Hardware acceleration for smooth 60fps animations</div>
                </div>
                <div className="space-y-2">
                  <div className="text-2xl">♿</div>
                  <div className="font-medium">Accessibility First</div>
                  <div className="text-sm text-muted-foreground">Respects prefers-reduced-motion settings</div>
                </div>
                <div className="space-y-2">
                  <div className="text-2xl">🔧</div>
                  <div className="font-medium">Developer Friendly</div>
                  <div className="text-sm text-muted-foreground">Simple APIs with TypeScript support</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </AnimatedContainer>
      </div>
    </div>
  );
}