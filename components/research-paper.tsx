'use client'

import { useState } from 'react'

type ResearchPaperProps = {
  title: string
  journal: string
  year: number
  links: { name: string; url: string }[]
  abstract: string
}

export default function ResearchPaper({
  title,
  journal,
  year,
  links,
  abstract,
}: ResearchPaperProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="my-4">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="group -mx-2 px-2 focus-visible:outline focus-visible:outline-rurikon-400 focus-visible:rounded-xs focus-visible:outline-dotted focus-visible:text-rurikon-600 cursor-pointer"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-1">
          <span className="block text-rurikon-500 group-hover:text-rurikon-700 group-focus-visible:text-rurikon-700">
            <strong>{title}</strong>
          </span>
        </div>
      </div>
      <div className="text-sm text-rurikon-400 mt-1">
        <em>{journal}</em>
      </div>      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-96' : 'max-h-0'
          }`}
      >
        <div className="border-l-2 border-rurikon-100 pl-4 mt-2 pt-2 pb-2">
          <p className="text-rurikon-600 break-words text-justify">{abstract}</p>
          <div className="mt-2">
            {links.map((link, index) => (
              <span key={link.name} className="mr-4">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-rurikon-500 hover:text-rurikon-700 no-underline"
                >
                  {link.name}
                </a>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
