(function () {
  var params = new URLSearchParams(window.location.search);
  var allowedKeys = ["utm_source", "utm_medium", "utm_campaign"];
  var attribution = {};

  allowedKeys.forEach(function (key) {
    var value = params.get(key);
    if (value) attribution[key] = value.slice(0, 120);
  });

  if (Object.keys(attribution).length) {
    document.querySelectorAll('a[href^="contact.html"]').forEach(function (link) {
      var target = new URL(link.getAttribute("href"), window.location.href);
      Object.keys(attribution).forEach(function (key) {
        target.searchParams.set(key, attribution[key]);
      });
      link.setAttribute("href", target.pathname.split("/").pop() + target.search + target.hash);
    });
  }

  var fieldMap = {
    utm_source: "traffic-source",
    utm_medium: "traffic-medium",
    utm_campaign: "campaign-name"
  };

  Object.keys(fieldMap).forEach(function (key) {
    var field = document.getElementById(fieldMap[key]);
    if (field && attribution[key]) field.value = attribution[key];
  });
})();
