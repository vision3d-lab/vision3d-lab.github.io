(() => {
  "use strict";

  const assetExists = async (url) => {
    try {
      const response = await fetch(url, { method: "HEAD", cache: "no-store" });
      return response.ok;
    } catch (_) {
      return false;
    }
  };

  const addImage = (slot, source) => {
    const image = document.createElement("img");
    image.src = source;
    image.alt = slot.dataset.alt || "MATE project media";
    image.loading = slot.classList.contains("hero-media") ? "eager" : "lazy";
    image.decoding = "async";
    slot.replaceChildren(image);
    slot.classList.add("has-media");
  };

  const addVideo = (slot, source) => {
    const video = document.createElement("video");
    video.src = source;
    video.autoplay = true;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.setAttribute("aria-label", slot.dataset.alt || "MATE project video");
    slot.replaceChildren(video);
    slot.classList.add("has-media");
  };

  const hydrateSlot = async (slot) => {
    const videoSource = slot.dataset.videoSrc;
    const imageSource = slot.dataset.imageSrc;

    if (videoSource && await assetExists(videoSource)) {
      addVideo(slot, videoSource);
      return;
    }

    if (imageSource && await assetExists(imageSource)) {
      addImage(slot, imageSource);
    }
  };

  document.querySelectorAll(".media-slot").forEach(hydrateSlot);

  document.querySelectorAll('a[aria-disabled="true"]').forEach((link) => {
    link.addEventListener("click", (event) => event.preventDefault());
  });
})();
