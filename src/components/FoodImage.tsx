export default function FoodImage({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  const [url, position] = src.split('#');
  const [column, row] = (position || '').split(',').map(Number);
  const sprite = position && Number.isInteger(column) && Number.isInteger(row);
  return <span className={`food-photo ${className}`}><img src={url} alt={alt} loading="lazy" style={sprite ? { position: 'absolute', width: '300%', maxWidth: 'none', height: '200%', left: `${-column * 100}%`, top: `${-row * 100}%`, objectFit: 'fill' } : undefined}/></span>;
}
