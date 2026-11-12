(function () {
  var banner = document.querySelector("[data-banner]");
  var next = document.querySelector("[data-banner-next]");
  var prev = document.querySelector("[data-banner-prev]");
  if (banner && next) {
    next.addEventListener("click", function () {
      banner.scrollBy({ left: 320, behavior: "smooth" });
    });
  }
  if (banner && prev) {
    prev.addEventListener("click", function () {
      banner.scrollBy({ left: -320, behavior: "smooth" });
    });
  }

  var frame = document.querySelector("[data-play-frame]");
  if (frame) {
    var id = frame.getAttribute("data-game");
    var plays = document.querySelector("[data-plays]");
    frame.addEventListener("load", function () {
      fetch("/api/games/" + id + "/play", { method: "POST" })
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
      fetch("/api/games/" + gameId + "/like", { method: "POST" }).then(function (response) {
        if (response.status === 401) {
          window.location.href = "/login?next=" + encodeURIComponent("/g/" + gameId);
          return null;
        }
        return response.json();
      }).then(function (body) {
        if (!body) return;
        var node = document.querySelector("[data-likes]");
        if (node && typeof body.likes === "number") node.textContent = String(body.likes);
        like.textContent = body.liked ? "Liked" : "Like";
      });
    });
  }
})();
