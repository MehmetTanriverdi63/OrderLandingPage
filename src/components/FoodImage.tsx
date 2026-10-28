import { Pizza, CookingPot, Beef, Flame, Utensils } from 'lucide-react';
export default function FoodImage({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  if (src.startsWith('illustration:')) {
    const category = src.slice(13);
    const Icon = category === 'Pizza' ? Pizza : category === 'Pasta' ? CookingPot : category === 'Schnitzel' ? Beef : category === 'Pide' ? Flame : Utensils;
    return <span role="img" aria-label={alt || category} className={`food-photo food-illustration ${className}`}><span className="illustration-orbit"/><Icon size={64} strokeWidth={1}/><span className="illustration-label">{category}</span></span>;
  }
  const [url, position] = src.split('#');
  const [column, row] = (position || '').split(',').map(Number);
  const sprite = position && Number.isInteger(column) && Number.isInteger(row);
  return <span className={`food-photo ${className}`}><img src={url} alt={alt} loading="lazy" style={sprite ? { position: 'absolute', width: '300%', maxWidth: 'none', height: '200%', left: `${-column * 100}%`, top: `${-row * 100}%`, objectFit: 'fill' } : undefined}/></span>;
}
