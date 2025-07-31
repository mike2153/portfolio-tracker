'use client'

import Image from 'next/image'
import { useState } from 'react'

interface SmartImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  fill?: boolean
  className?: string
  fallbackIcon?: React.ReactNode
}

// Known safe domains that are configured in next.config.js
const SAFE_DOMAINS = [
  'g.foolcdn.com',
  'cdn.finra.org',
  'seekingalpha.com',
  'static.seekingalpha.com',
  'images.unsplash.com',
  'via.placeholder.com',
  'cdn.marketaux.com',
  'assets.marketwatch.com',
]

export default function SmartImage({
  src,
  alt,
  width,
  height,
  fill,
  className,
  fallbackIcon
}: SmartImageProps) {
  const [imageError, setImageError] = useState(false)
  const [useProxy, setUseProxy] = useState(false)

  // Check if domain is safe
  const isSafeDomain = (url: string) => {
    try {
      const hostname = new URL(url).hostname
      return SAFE_DOMAINS.some(domain => hostname === domain)
    } catch {
      return false
    }
  }

  // Handle image error - try proxy if not already using it
  const handleImageError = () => {
    if (!useProxy && !isSafeDomain(src)) {
      setUseProxy(true)
    } else {
      setImageError(true)
    }
  }

  // If image failed completely, show fallback
  if (imageError) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900 ${className}`}>
        {fallbackIcon || (
          <div className="text-gray-600 text-4xl font-bold">
            📰
          </div>
        )}
      </div>
    )
  }

  // Determine image source
  const imageSrc = useProxy && !isSafeDomain(src) 
    ? `/api/image-proxy?url=${encodeURIComponent(src)}`
    : src

  return (
    <Image
      src={imageSrc}
      alt={alt}
      width={width}
      height={height}
      fill={fill}
      className={className}
      onError={handleImageError}
      unoptimized={useProxy} // Disable optimization for proxied images
    />
  )
}