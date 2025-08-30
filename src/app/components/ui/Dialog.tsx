"use client"

import { Fragment, useEffect } from 'react'
import { X } from 'lucide-react'

interface DialogProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'custom'
  customSize?: {
    width?: string
    height?: string
    minWidth?: string
    minHeight?: string
    maxWidth?: string
    maxHeight?: string
  }
}

export default function Dialog({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'md',
  customSize 
}: DialogProps) {
  // Chiudi dialog con ESC
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden' // Previeni scroll del body
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  // Determina le classi di dimensione
  const getSizeClasses = () => {
    if (size === 'custom' && customSize) {
      return {}
    }
    
    switch (size) {
      case 'sm':
        return 'max-w-md'
      case 'md':
        return 'max-w-lg'
      case 'lg':
        return 'max-w-2xl'
      case 'xl':
        return 'max-w-4xl'
      default:
        return 'max-w-lg'
    }
  }

  const getCustomStyles = () => {
    if (size === 'custom' && customSize) {
      return {
        width: customSize.width,
        height: customSize.height,
        minWidth: customSize.minWidth,
        minHeight: customSize.minHeight,
        maxWidth: customSize.maxWidth,
        maxHeight: customSize.maxHeight,
      }
    }
    return {}
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Dialog container */}
      <div className="flex min-h-full items-center justify-center p-4 text-center sm:items-center sm:p-0">
        <div 
          className={`
            relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all
            ${size === 'custom' ? 'w-full flex flex-col' : `w-full ${getSizeClasses()}`}
          `}
          style={getCustomStyles()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          {title && (
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {title}
              </h3>
              <button
                onClick={onClose}
                className="rounded-md text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                aria-label="Chiudi dialog"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          )}
          
          {/* Content */}
          <div className={`${size === 'custom' ? 'flex-1 flex flex-col overflow-hidden' : ''} ${title ? '' : 'pt-6'}`}>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
