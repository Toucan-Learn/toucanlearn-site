(function () {
  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();

(function () {
  document.querySelectorAll("[data-carousel]").forEach(function (carousel) {
    var stage = carousel.querySelector(".carousel-stage");
    var slides = Array.from(carousel.querySelectorAll("[data-slide]"));
    var dots = Array.from(carousel.querySelectorAll("[data-dot]"));
    var current = carousel.querySelector("[data-current]");
    var previous = carousel.querySelector("[data-prev]");
    var next = carousel.querySelector("[data-next]");
    var activeIndex = 0;
    var touchStartX = 0;

    if (!stage || !slides.length || slides.length !== dots.length || !current || !previous || !next) return;

    function syncStageHeight(immediate) {
      var activeSlide = slides[activeIndex];
      if (!activeSlide) return;

      if (immediate) stage.classList.add("is-measuring");
      stage.style.height = Math.ceil(activeSlide.getBoundingClientRect().height) + "px";
      if (immediate) requestAnimationFrame(function () { stage.classList.remove("is-measuring"); });
    }

    function showSlide(index) {
      activeIndex = (index + slides.length) % slides.length;

      slides.forEach(function (slide, slideIndex) {
        var isActive = slideIndex === activeIndex;
        slide.classList.toggle("is-active", isActive);
        slide.setAttribute("aria-hidden", String(!isActive));
        slide.toggleAttribute("inert", !isActive);
      });

      dots.forEach(function (dot, dotIndex) {
        var isActive = dotIndex === activeIndex;
        dot.classList.toggle("is-active", isActive);
        if (isActive) dot.setAttribute("aria-current", "true");
        else dot.removeAttribute("aria-current");
      });

      current.textContent = String(activeIndex + 1);
      requestAnimationFrame(function () { syncStageHeight(false); });
    }

    previous.addEventListener("click", function () { showSlide(activeIndex - 1); });
    next.addEventListener("click", function () { showSlide(activeIndex + 1); });
    dots.forEach(function (dot, index) {
      dot.addEventListener("click", function () { showSlide(index); });
    });

    carousel.addEventListener("keydown", function (event) {
      if (event.key === "ArrowLeft") showSlide(activeIndex - 1);
      if (event.key === "ArrowRight") showSlide(activeIndex + 1);
    });

    carousel.addEventListener("touchstart", function (event) {
      touchStartX = event.changedTouches[0].clientX;
    }, { passive: true });

    carousel.addEventListener("touchend", function (event) {
      var distance = event.changedTouches[0].clientX - touchStartX;
      if (Math.abs(distance) < 48) return;
      showSlide(activeIndex + (distance < 0 ? 1 : -1));
    }, { passive: true });

    if ("ResizeObserver" in window) {
      var slideObserver = new ResizeObserver(function () { syncStageHeight(false); });
      slides.forEach(function (slide) { slideObserver.observe(slide); });
    }

    window.addEventListener("resize", function () { syncStageHeight(true); }, { passive: true });
    window.addEventListener("load", function () { syncStageHeight(true); }, { once: true });

    showSlide(0);
    syncStageHeight(true);
  });
})();
