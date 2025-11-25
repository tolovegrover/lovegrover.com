'use client'

import { useState } from 'react'

type StoryItemProps = {
    title: string
    subtitle?: string
    author?: string
    date: string
    children: React.ReactNode
}

export default function StoryItem({
    title,
    subtitle,
    author,
    date,
    children,
}: StoryItemProps) {
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
                {subtitle && (
                    <div className="text-sm text-rurikon-400 mt-1">
                        <em>
                            {subtitle} {author && <span> - {author}</span>}
                        </em>
                    </div>
                )}
            </div>

            <div
                className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-96' : 'max-h-0'
                    }`}
            >
                <div className="border-l-2 border-rurikon-100 pl-4 mt-2 pt-2 pb-2 text-justify">
                    {children}
                </div>
            </div>
        </div>
    )
}
