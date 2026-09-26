import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://riddhithakkarportfolio.pages.dev' },
    { url: 'https://riddhithakkarportfolio.pages.dev/about' },
    { url: 'https://riddhithakkarportfolio.pages.dev/work/video' },
    { url: 'https://riddhithakkarportfolio.pages.dev/work/graphic-design' },
    { url: 'https://riddhithakkarportfolio.pages.dev/work/art' },
  ]
}
