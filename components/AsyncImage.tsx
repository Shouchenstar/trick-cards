"use client";

import { useEffect, useState } from "react";
import { resolveImageSrc } from "@/lib/imageStorage";

type AsyncImageProps = React.ImgHTMLAttributes<HTMLImageElement>;

export function AsyncImage({ src, ...rest }: AsyncImageProps) {
  const [resolvedSrc, setResolvedSrc] = useState<string>("");

  useEffect(() => {
    if (typeof src !== "string" || !src) {
      setResolvedSrc("");
      return;
    }
    resolveImageSrc(src).then(setResolvedSrc);
  }, [src]);

  if (!resolvedSrc) return null;

  return <img src={resolvedSrc} {...rest} />;
}
