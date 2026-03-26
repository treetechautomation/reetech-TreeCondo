
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/painel', '/api'],
    },
    sitemap: 'https://treecondo.treetechautomation.com/sitemap.xml',
  };
}
