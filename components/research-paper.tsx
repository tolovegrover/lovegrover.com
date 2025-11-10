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
                className="group flex gap-1 -mx-2 px-2 justify-between items-center focus-visible:outline focus-visible:outline-rurikon-400 focus-visible:rounded-xs focus-visible:outline-dotted focus-visible:text-rurikon-600 cursor-pointer"
              >
                <span className="block text-rurikon-500 group-hover:text-rurikon-700 group-focus-visible:text-rurikon-700 shrink-0">
                  <strong>{title}</strong>
                </span>
                <span className="text-sm dot-leaders flex-1 text-rurikon-100 font-normal group-hover:text-rurikon-500 group-focus-visible:text-rurikon-500 transition-colors group-hover:transition-none leading-none min-w-4" />
                <span className="text-sm text-rurikon-300 group-hover:text-rurikon-500 group-focus-visible:text-rurikon-500 shrink-0">
                  {year}
                </span>
              </div>
              <div className="text-sm text-gray-500 mt-1">
                <em>{journal}</em>
              </div>      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isOpen ? 'max-h-96' : 'max-h-0'
        }`}
      >
        <div className="border-l-2 border-gray-200 pl-4 mt-2 pt-2 pb-2">
          <p className="text-gray-700">{abstract}</p>
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
