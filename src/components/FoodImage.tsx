import { useLayoutEffect, useRef, useState } from 'react';
type Props = { src: string; alt: string; className?: string };
function SpritePhoto({ src, alt, className = '' }: Props) {
  const frame = useRef<HTMLSpanElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [url, coordinates] = src.split('#');
  const parts=coordinates.split(',');
  const rect=parts[0]==='rect';
  const [column,row,columns=3,rows=2]=parts.map(Number);
  const [rectX,rectY,rectWidth,rectHeight]=parts.slice(1).map(Number);
  useLayoutEffect(() => {
    const element = frame.current!;
    const update = () => { const rect=element.getBoundingClientRect();setBox(previous=>previous.width===rect.width && previous.height===rect.height ? previous : {width:rect.width,height:rect.height}); };
    update();const observer=new ResizeObserver(update);observer.observe(element);return()=>observer.disconnect();
  }, []);
  const tileWidth=rect ? rectWidth : natural.width / columns, tileHeight=rect ? rectHeight : natural.height / rows;
  const originX=rect ? rectX : column*tileWidth, originY=rect ? rectY : row*tileHeight;
  const scale=natural.width && box.width ? Math.max(box.width/tileWidth,box.height/tileHeight) : 0;
  return <span ref={frame} className={`food-photo ${className}`}><img src={url} alt={alt} loading="lazy" onLoad={e=>setNatural({width:e.currentTarget.naturalWidth,height:e.currentTarget.naturalHeight})} style={{position:'absolute',maxWidth:'none',width:natural.width*scale,height:natural.height*scale,left:(box.width-tileWidth*scale)/2-originX*scale,top:(box.height-tileHeight*scale)/2-originY*scale,objectFit:'contain',transformOrigin:`${(originX+tileWidth/2)*scale}px ${(originY+tileHeight/2)*scale}px`,visibility:scale?'visible':'hidden'}}/></span>;
}
export default function FoodImage(props: Props) {
  if (props.src.includes('#')) return <SpritePhoto key={props.src} {...props}/>;
  return <span className={`food-photo ${props.className || ''}`}><img src={props.src} alt={props.alt} loading="lazy"/></span>;
}
