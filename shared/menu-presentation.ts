import artwork from '../data/menu-artwork.json';
import { RESTAURANT, type Product } from './model';
const photos = new Map(artwork.products.map(p => [p.number,p.image]));
export function isRetiredProduct(product: Pick<Product,'restaurant_id'|'category'|'menu_number'>) {
  return product.restaurant_id===RESTAURANT && (product.category.toLocaleLowerCase('de')==='schnitzel' || artwork.retiredNumbers.includes(product.menu_number || ''));
}
export function presentProduct(product: Product): Product {
  if(product.restaurant_id!==RESTAURANT)return product;
  let image=product.image.replace('/images/doner.png','/images/doner.webp').replace('/images/menu-grid.png','/images/menu-grid.webp');
  const bundled=/^\/images\/(?:doner|menu-grid|pizza-collection|pizza-specials|pasta-collection|pasta-specials|pide-snacks-collection|menu-specials|menu-salads-v2|menu-doner-v2|menu-wraps-pizza-v2|menu-specials-v2)\.(?:png|webp)(?:#|$)/.test(image);
  if((image.startsWith('illustration:') || bundled) && product.menu_number) image=photos.get(product.menu_number) || image;
  return {...product,image};
}
