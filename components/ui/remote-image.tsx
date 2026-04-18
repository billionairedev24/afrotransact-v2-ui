import Image from "next/image"

type Props = {
  src: string
  alt: string
  className?: string
  /** Parent must be `relative` with explicit size */
  fill?: boolean
  width?: number
  height?: number
  sizes?: string
  priority?: boolean
}

export function RemoteImage({ src, alt, className, fill, width, height, sizes, priority }: Props) {
  if (!src) return null
  return (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      className={className}
      sizes={sizes}
      priority={priority}
    />
  )
}
