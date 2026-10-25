import { Baby, HeartHandshake, BookOpen, Paintbrush, Sparkles } from 'lucide-react';
import type { Category } from '../lib/types';

// One visual language for services across provider profiles and marketplace cards.
const icons = {
  nanny: Baby,
  confinement: HeartHandshake,
  tutor: BookOpen,
  makeup: Paintbrush,
  cleaning: Sparkles,
};
export function CategoryIcon({
  category,
  size = 20,
  className,
}: {
  category: Category;
  size?: number;
  className?: string;
}) {
  const Icon = icons[category] ?? Sparkles;
  return <Icon size={size} className={className} strokeWidth={1.8} aria-hidden="true" />;
}
