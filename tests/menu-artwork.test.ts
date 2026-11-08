import { describe,it,expect } from 'vitest';
import { existsSync } from 'node:fs';
import artwork from '../data/menu-artwork.json';
import card from '../data/menu-card.json';
import { presentProduct } from '../shared/menu-presentation';
import { RESTAURANT,type Product } from '../shared/model';
describe('distinct menu photography',()=>{
  it('covers every active dish with a different existing image region',()=>{
    const active=card.products.filter(p=>p.category!=='Schnitzel');
    expect(artwork.products).toHaveLength(active.length);
    expect(new Set(artwork.products.map(p=>p.number)).size).toBe(active.length);
    expect(new Set(artwork.products.map(p=>p.image)).size).toBe(active.length);
    for(const item of active){
      const picture=artwork.products.find(p=>p.number===item.number);
      expect(picture?.name).toBe(item.name);
      expect(existsSync(`public${picture!.image.split('#')[0]}`)).toBe(true);
    }
  });
  it('repairs old shared salad images immediately while preserving custom photos and tenant data',()=>{
    const p={restaurant_id:RESTAURANT,menu_number:'2',image:'/images/menu-grid.webp#2,0'} as Product;
    expect(presentProduct(p).image).toBe(artwork.products.find(p=>p.number==='2')!.image);
    const custom={...p,image:'https://restaurant.example/own-salad.webp'};
    expect(presentProduct(custom).image).toBe(custom.image);
    expect(presentProduct({...p,restaurant_id:'other'}).image).toBe(p.image);
  });
});
