import { cn } from "@/lib/utils";

interface UnderConstructionProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  className?: string;
}

export default function UnderConstruction({ 
  title, 
  description, 
  icon, 
  className 
}: UnderConstructionProps) {
  return (
    <div className={cn("under-construction rounded-xl p-12 text-center", className)}>
      <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6">
        {icon}
      </div>
      <h3 className="text-2xl font-bold text-foreground mb-4" data-testid="text-construction-title">
        {title}
      </h3>
      <p className="text-muted-foreground text-lg max-w-2xl mx-auto" data-testid="text-construction-description">
        {description}
      </p>
    </div>
  );
}
