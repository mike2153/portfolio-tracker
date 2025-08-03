'use client'

import { useState, useEffect, useRef } from 'react'

interface ProgressiveImageProps {
  src: string
  placeholderSrc?: string
  alt: string
  className?: string
  width?: number
  height?: number
  priority?: boolean
  blurDataURL?: string
}

export const ProgressiveImage = ({
  src,
  placeholderSrc,
  alt,
  className = '',
  width,
  height,
  priority = false,
  blurDataURL
}: ProgressiveImageProps) => {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(priority)
  const [imageSrc, setImageSrc] = useState(placeholderSrc || blurDataURL || '')
  const imgRef = useRef<HTMLImageElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  // Generate blur placeholder if not provided
  const getBlurDataURL = (w: number = 10, h: number = 10) => {
    if (blurDataURL) return blurDataURL
    
    // Create a simple blur data URL
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (ctx) {
      // Create a gradient for placeholder
      const gradient = ctx.createLinearGradient(0, 0, w, h)
      gradient.addColorStop(0, '#1E293B')
      gradient.addColorStop(0.5, '#334155')
      gradient.addColorStop(1, '#1E293B')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, w, h)
    }
    return canvas.toDataURL()
  }

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry && entry.isIntersecting) {
          setIsInView(true)
          observerRef.current?.disconnect()
        }
      },
      { 
        threshold: 0.1,
        rootMargin: '50px' // Start loading 50px before the image comes into view
      }
    )

    if (imgRef.current && observerRef.current) {
      observerRef.current.observe(imgRef.current)
    }

    return () => {
      observerRef.current?.disconnect()
    }
  }, [priority])

  // Load high-quality image when in view
  useEffect(() => {
    if (!isInView) return

    const img = new Image()
    img.onload = () => {
      setImageSrc(src)
      // Small delay to ensure smooth transition
      setTimeout(() => setIsLoaded(true), 100)
    }
    img.onerror = () => {
      // Fallback to placeholder if main image fails
      setImageSrc(placeholderSrc || getBlurDataURL())
      setIsLoaded(true)
    }
    img.src = src
  }, [isInView, src, placeholderSrc])

  // Set initial placeholder
  useEffect(() => {
    if (!imageSrc && !priority) {
      setImageSrc(getBlurDataURL())
    }
  }, [imageSrc, priority])

  return (
    <div 
      className={`relative overflow-hidden ${className}`}
      style={{ width, height }}
    >
      {/* Main Image */}
      <img
        ref={imgRef}
        src={imageSrc || getBlurDataURL()}
        alt={alt}
        width={width}
        height={height}
        className={`
          w-full h-full object-cover transition-all duration-700 ease-out
          ${isLoaded 
            ? 'opacity-100 scale-100 filter-none' 
            : 'opacity-90 scale-105 filter blur-md'
          }
        `}
        onLoad={() => {
          if (imageSrc === src) {
            setIsLoaded(true)
          }
        }}
      />

      {/* Loading Skeleton */}
      {!isLoaded && (
        <div className="absolute inset-0 skeleton-loading animate-pulse">
          <div className="w-full h-full bg-gradient-to-br from-[#1E293B] via-[#334155] to-[#1E293B]"></div>
        </div>
      )}

      {/* Loading Indicator */}
      {isInView && !isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1E293B]/80 backdrop-blur-sm">
          <div className="flex items-center space-x-2 text-[#10B981]">
            <div className="w-4 h-4 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm font-medium">Loading...</span>
          </div>
        </div>
      )}

      {/* Success Indicator (briefly shown when loaded) */}
      {isLoaded && (
        <div className="absolute top-2 right-2 opacity-0 animate-ping">
          <div className="w-2 h-2 bg-[#10B981] rounded-full"></div>
        </div>
      )}
    </div>
  )
}