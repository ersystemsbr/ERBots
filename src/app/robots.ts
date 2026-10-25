import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/cadastro', '/login', '/termos', '/privacidade'],
        disallow: ['/dashboard', '/admin', '/api/', '/redefinir-senha'],
      },
    ],
    sitemap: 'https://www.erbots.com.br/sitemap.xml',
  };
}
