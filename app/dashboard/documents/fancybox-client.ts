"use client";

import { Fancybox as NativeFancybox } from "@fancyapps/ui/dist/fancybox/";

export type FancyboxItem = {
  src: string;
  mimeType: string;
  caption: string;
};

function escapeAttribute(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function toSlide(item: FancyboxItem) {
  if (item.mimeType.startsWith("image/")) {
    return {
      src: item.src,
      type: "image",
      caption: item.caption,
    };
  }

  if (item.mimeType === "application/pdf") {
    return {
      src: item.src,
      type: "iframe",
      caption: item.caption,
      preload: false,
    };
  }

  if (item.mimeType.startsWith("video/")) {
    return {
      src: item.src,
      type: "html5video",
      caption: item.caption,
    };
  }

  if (item.mimeType.startsWith("audio/")) {
    const safeSrc = escapeAttribute(item.src);
    const safeCaption = escapeAttribute(item.caption);
    return {
      type: "html",
      src: `<div style="padding:24px;max-width:560px"><p style="margin-bottom:12px;font-size:14px">${safeCaption}</p><audio controls style="width:100%" src="${safeSrc}"></audio></div>`,
      caption: item.caption,
    };
  }

  return {
    src: item.src,
    type: "iframe",
    caption: item.caption,
    preload: false,
  };
}

export function openDocFancybox(items: FancyboxItem[], startIndex: number) {
  NativeFancybox.show(items.map(toSlide), {
    startIndex,
    dragToClose: false,
    placeFocusBack: false,
    closeButton: "auto",
  });
}
