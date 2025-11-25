import { promises as fs } from 'fs'
import path from 'path'
import StoryItem from '@/components/story-item'

export const metadata = {
  title: 'Stories',
}

// In the future we can have a pagination here e.g. /1/*.mdx
const articlesDirectory = path.join(
  process.cwd(),
  'app',
  'stories',
  '_articles'
)

export default async function Page() {
  const articles = await fs.readdir(articlesDirectory)

  const items = []
  for (const article of articles) {
    if (!article.endsWith('.mdx')) continue
    const module = await import('./_articles/' + article)
    const Content = module.default

    if (!module.metadata) throw new Error('Missing `metadata` in ' + article)

    items.push({
      slug: article.replace(/\.mdx$/, ''),
      title: module.metadata.title,
      subtitle: module.metadata.subtitle,
      author: module.metadata.author,
      date: module.metadata.date || '-',
      sort: Number(module.metadata.date?.replaceAll('.', '') || 0),
      Content: Content,
    })
  }
  items.sort((a, b) => b.sort - a.sort)

  return (
    <div>
      <ul>
        {items.map((item) => (
          <li key={item.slug}>
            <StoryItem
              title={item.title}
              subtitle={item.subtitle}
              author={item.author}
              date={item.date}
            >
              <item.Content />
            </StoryItem>
          </li>
        ))}
      </ul>
    </div>
  )
}