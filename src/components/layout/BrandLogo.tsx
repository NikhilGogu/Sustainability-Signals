type BrandLogoProps = {
  alt?: string;
  wrapperClassName?: string;
  imageClassName?: string;
  lightSrc?: string;
  darkSrc?: string;
  lightSrcSet?: string;
  darkSrcSet?: string;
  width?: number;
  height?: number;
  eager?: boolean;
};

export function BrandLogo({
  alt = 'Sustainability Signals logo',
  wrapperClassName = 'w-9 h-9 rounded-xl overflow-hidden',
  imageClassName = 'w-full h-full object-contain',
  lightSrc = '/logo-white.png',
  darkSrc = '/logo-dark.png',
  lightSrcSet,
  darkSrcSet,
  width = 512,
  height = 512,
  eager = false,
}: BrandLogoProps) {
  const loading = eager ? 'eager' : 'lazy';

  return (
    <span className={wrapperClassName}>
      <img
        src={lightSrc}
        srcSet={lightSrcSet}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        decoding="async"
        className={`block dark:hidden ${imageClassName}`}
      />
      <img
        src={darkSrc}
        srcSet={darkSrcSet}
        alt=""
        aria-hidden="true"
        width={width}
        height={height}
        loading={loading}
        decoding="async"
        className={`hidden dark:block ${imageClassName}`}
      />
    </span>
  );
}
