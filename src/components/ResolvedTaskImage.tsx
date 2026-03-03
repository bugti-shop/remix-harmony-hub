import { useResolvedTaskMedia } from '@/hooks/useResolvedTaskMedia';

interface ResolvedTaskImageProps {
  srcRef?: string | null;
  alt: string;
  className?: string;
}

export const ResolvedTaskImage = ({ srcRef, alt, className }: ResolvedTaskImageProps) => {
  const resolved = useResolvedTaskMedia(srcRef);
  if (!resolved) return null;
  return <img src={resolved} alt={alt} className={className} />;
};
