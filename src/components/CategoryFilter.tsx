'use client'

import React from 'react'
import { JOB_CATEGORIES, type JobCategory } from '@/types'

interface CategoryFilterProps {
  selectedCategories: JobCategory[]
  onToggleCategory: (category: JobCategory) => void
}

export function CategoryFilter({
  selectedCategories,
  onToggleCategory,
}: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-2 pt-2">
      {JOB_CATEGORIES.map((cat) => {
        const isSelected = selectedCategories.includes(cat)
        return (
          <button
            key={cat}
            type="button"
            onClick={() => onToggleCategory(cat)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              isSelected
                ? 'bg-[#18181b] text-white shadow-sm'
                : 'border border-[#dededb] bg-[#fafaf9] text-[#71717a] hover:bg-[#ededeb] hover:text-[#18181b]'
            }`}
          >
            {cat}
          </button>
        )
      })}
    </div>
  )
}
