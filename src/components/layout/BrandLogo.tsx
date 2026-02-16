type BrandLogoProps = {
  alt?: string;
  wrapperClassName?: string;
  imageClassName?: string;
  eager?: boolean;
};

export function BrandLogo({
  alt = 'Sustainability Signals logo',
  wrapperClassName = 'w-9 h-9 rounded-xl overflow-hidden',
  imageClassName = 'w-full h-full object-contain',
  eager = false,
}: BrandLogoProps) {
  const loading = eager ? 'eager' : 'lazy';

  return (
    <span className={wrapperClassName}>
      <img
        src="/logo-white.png"
        alt={alt}
        width={512}
        height={512}
        loading={loading}
        decoding="async"
        className={`block dark:hidden ${imageClassName}`}
      />
      <img
        src="/logo-dark.png"
        alt=""
        aria-hidden="true"
        width={512}
        height={512}
        loading={loading}
        decoding="async"
        className={`hidden dark:block ${imageClassName}`}
      />
    </span>
  );
}
