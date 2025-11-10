import { promises as fs } from 'fs'
import Link from 'next/link'
import path from 'path'

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

    if (!module.metadata) throw new Error('Missing `metadata` in ' + article)

    items.push({
      slug: article.replace(/\.mdx$/, ''),
      title: module.metadata.title,
      date: module.metadata.date || '-',
      sort: Number(module.metadata.date?.replaceAll('.', '') || 0),
    })
  }
  items.sort((a, b) => b.sort - a.sort)

  return (
    <div>
      <ul>
        {items.map((item) => (
          <li key={item.slug} className='font-medium'>
            <Link
              href={`/stories/${item.slug}`}
              className='group flex gap-1 -mx-2 px-2 justify-between items-center focus-visible:outline focus-visible:outline-rurikon-400 focus-visible:rounded-xs focus-visible:outline-dotted focus-visible:text-rurikon-600'
              draggable={false}
            >
              <span className='block text-rurikon-500 group-hover:text-rurikon-700 group-focus-visible:text-rurikon-700'>
                {item.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}