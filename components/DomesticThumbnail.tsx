"use client";

import Image from "next/image";
import { useState } from "react";

export function DomesticThumbnail({ image, title, url }: { image?: string | null; title: string; url: string }) {
  const [failed, setFailed] = useState(false);
  if (!image || failed) return null;

  return (
    <a href={url} target="_blank" rel="noreferrer" aria-label={`${title} 원문 보기`} className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-surface-muted sm:h-[88px] sm:w-[88px]">
      <Image
        src={`/api/thumb?u=${encodeURIComponent(image)}`}
        alt=""
        width={88}
        height={88}
        sizes="88px"
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-full w-full object-cover"
      />
    </a>
  );
}
