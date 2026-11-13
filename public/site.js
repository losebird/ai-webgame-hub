(function () {
  var banner = document.querySelector("[data-banner]");
  var next = document.querySelector("[data-banner-next]");
  var prev = document.querySelector("[data-banner-prev]");
  if (banner && next) {
    next.addEventListener("click", function () {
      banner.scrollBy({ left: Math.min(banner.clientWidth * 0.9, 360), behavior: "smooth" });
    });
  }
  if (banner && prev) {
    prev.addEventListener("click", function () {
      banner.scrollBy({ left: -Math.min(banner.clientWidth * 0.9, 360), behavior: "smooth" });
    });
  }

  var csrfMeta = document.querySelector('meta[name="csrf-token"]');
  var csrf = csrfMeta ? csrfMeta.getAttribute("content") : "";

  function post(url) {
    return fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: { "x-csrf-token": csrf || "" },
    });
  }

  var frame = document.querySelector("[data-play-frame]");
  if (frame) {
    var id = frame.getAttribute("data-game");
    var plays = document.querySelector("[data-plays]");
    frame.addEventListener("load", function () {
      post("/api/games/" + id + "/play")
        .then(function (response) { return response.json(); })
        .then(function (body) {
          if (plays && typeof body.plays === "number") plays.textContent = String(body.plays);
        });
    });
  }

  var like = document.querySelector("[data-like]");
  if (like) {
    like.addEventListener("click", function () {
      var gameId = like.getAttribute("data-like");
      post("/api/games/" + gameId + "/like").then(function (response) {
        if (response.status === 401) {
          var locale = (document.documentElement.lang || "en").indexOf("zh") === 0 ? "zh" : "en";
          window.location.href = "/" + locale + "/login?next=" + encodeURIComponent("/" + locale + "/g/" + gameId);
          return null;
        }
        return response.json();
      }).then(function (body) {
        if (!body) return;
        var node = document.querySelector("[data-likes]");
        if (node && typeof body.likes === "number") node.textContent = String(body.likes);
        like.textContent = body.liked
          ? (like.getAttribute("data-liked-label") || "Liked")
          : (like.getAttribute("data-like-label") || "Like");
      });
    });
  }
})();
