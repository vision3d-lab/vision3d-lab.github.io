document.addEventListener("DOMContentLoaded", function() {
    var lazyVideo = document.querySelector('.lazy-video');
  
    // Function to hide loading animation
    function hideLoadingAnimation(videoElement) {
      var loadingAnimation = videoElement.parentNode.querySelector('.loading-animation');
      if (loadingAnimation) {
        loadingAnimation.style.display = 'none';
      }
    }
  
    if ('IntersectionObserver' in window) {
      var videoObserver = new IntersectionObserver(function(entries, observer) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            for (var source in entry.target.children) {
              var videoSource = entry.target.children[source];
              if (typeof videoSource.tagName === "string" && videoSource.tagName === "SOURCE") {
                videoSource.src = videoSource.dataset.src;
              }
            }
  
            entry.target.load();
            entry.target.classList.remove('lazy');
            videoObserver.unobserve(entry.target);
            
            // Hide the loading animation when the video is ready
            entry.target.addEventListener('loadeddata', function() {
              hideLoadingAnimation(entry.target);
            }, { once: true });
          }
        });
      });
  
      videoObserver.observe(lazyVideo);
    } else {
      // Fallback for browsers that don't support IntersectionObserver
      var source = lazyVideo.children[0];
      source.src = source.dataset.src;
      lazyVideo.load();
      
      // Immediately hide loading animation for fallback
      hideLoadingAnimation(lazyVideo);
    }
});
