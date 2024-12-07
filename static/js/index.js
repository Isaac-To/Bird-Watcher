"use strict";

const app = {};

// Redirect to the checklist page
app.redirectChecklist = function (latlng) {
  const query =
    "?lat=" + latlng.lat.toFixed(5) + "&lng=" + latlng.lng.toFixed(5);

  location.assign(checklist_url + query);

  app.closePopup();
};

// Redirect to the statistics page
app.redirectStatistics = function (fromlatlng, tolatlng) {
  const north = Math.max(fromlatlng.lat, tolatlng.lat);
  const east = Math.max(fromlatlng.lng, tolatlng.lng);
  const south = Math.min(fromlatlng.lat, tolatlng.lat);
  const west = Math.min(fromlatlng.lng, tolatlng.lng);
  const query =
    "?n=" +
    north.toFixed(5) +
    "&e=" +
    east.toFixed(5) +
    "&s=" +
    south.toFixed(5) +
    "&w=" +
    west.toFixed(5);

  location.assign(statistics_url + query);

  app.closePopup();
};

// Resize statistics rect based on position of handles
app.updateStatsRect = function () {
  if (app.statistics) {
    const min = app.statistics.minHandle.getLatLng();
    const max = app.statistics.maxHandle.getLatLng();
    const bounds = L.latLngBounds(min, max);

    app.statistics.rect.setBounds(bounds);
    app.statistics.popup.setLatLng({
      lat: Math.max(min.lat, max.lat),
      lng: (min.lng + max.lng) / 2,
    });
  }
};

// Create a rectangular region that the user can drag around
app.openStats = function (latlng) {
  app.closeStats();

  // Define rectangle geographical bounds
  // At zoom 18 (max zoom) this is 20 meters
  const size = 20 / Math.pow(2, app.map.getZoom() - 18);
  const bounds = latlng.toBounds(size);
  const markerOptions = {
    icon: app.handleIcon,
    keyboard: false,
    draggable: true,
  };

  // Create a rectangle with two draggable markers on the corners
  const rect = L.rectangle(bounds, { color: "#ff2000", weight: 1 }).addTo(
    app.map
  );
  const minHandle = L.marker(bounds.getSouthWest(), markerOptions).addTo(
    app.map
  );
  const maxHandle = L.marker(bounds.getNorthEast(), markerOptions).addTo(
    app.map
  );

  for (const handle of [minHandle, maxHandle]) {
    handle.on("move", app.updateStatsRect);
  }

  // Create a popup that redirects to the stats page
  const options = {
    closeButton: true,
    autoClose: false,
    closeOnClick: false,
    closeOnEscapeKey: true,
  };

  const buttonContainer = L.DomUtil.create("div");
  const statsButton = L.DomUtil.create("button", "button", buttonContainer);
  statsButton.innerText = "View Statistics";
  statsButton.addEventListener("click", (_) => {
    if (app.statistics)
      app.redirectStatistics(
        app.statistics.minHandle.getLatLng(),
        app.statistics.maxHandle.getLatLng()
      );
  });

  const popup = L.popup(options)
    .setLatLng(latlng)
    .setContent(buttonContainer)
    .openOn(app.map);

  popup.addEventListener("remove", app.closeStats);

  app.statistics = {
    rect: rect,
    minHandle: minHandle,
    maxHandle: maxHandle,
    popup: popup,
  };

  app.updateStatsRect();
};

// Remove the statistics rectangle, if it exists
app.closeStats = function () {
  const stats = app.statistics;
  if (stats) {
    stats.popup.close();
    stats.rect.remove();
    stats.minHandle.remove();
    stats.maxHandle.remove();
    app.statistics = undefined;
  }
};

// Open a popup to add sightings or see statistics at a position
app.openPopup = function (latlng) {
  if (app.popup) return app.popup;

  const options = {
    closeButton: false,
    autoClose: false,
    closeOnClick: false,
    closeOnEscapeKey: false,
  };

  const buttonContainer = L.DomUtil.create("div");
  const sightingButton = L.DomUtil.create(
    "button",
    "button mr-4",
    buttonContainer
  );
  sightingButton.innerText = "Add Sighting";
  sightingButton.addEventListener("click", (_) => {
    app.redirectChecklist(app.clickLatLng);
  });

  const infoButton = L.DomUtil.create("button", "button", buttonContainer);
  infoButton.innerText = "Statistics";
  infoButton.addEventListener("click", (_) => {
    app.openStats(app.clickLatLng);
  });

  return L.popup(options)
    .setLatLng(latlng)
    .setContent(buttonContainer)
    .openOn(app.map);
};

// Close the map's popup, if it is open
app.closePopup = function () {
  if (app.popup) {
    app.popup.close();
    app.popup = undefined;
  }
};

app.mapClicked = function (event) {
  app.clickLatLng = event.latlng;

  if (app.popup) {
    // Move popup if one was already open
    app.popup.setLatLng(event.latlng);
  } else {
    // If no popup exists, create one
    app.popup = app.openPopup(event.latlng);
  }
};

app.data = {
  data: function () {
    return {};
  },
  methods: {},
};

app.vue = Vue.createApp(app.data).mount("#app");

// Create resources
app.handleIcon = L.icon({
  iconUrl: "img/handle.png",
  iconSize: [10, 10],
  iconAnchor: [4.5, 4.5],
});

// Initialize Leaflet map centered on the U.S.
app.map = L.map("map", {
  center: [38, -98],
  zoom: 4,
});
app.map.on("click", app.mapClicked);
app.map.on("blur", app.closePopup);

// Add street map
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(app.map);

// Add heatmap, populating it with sighting data
app.heat = L.heatLayer([]).addTo(app.map);

// Zoom in on user's approximate location
axios("https://geolocation-db.com/json/").then((res) => {
  const lat = res.data.latitude;
  const lng = res.data.longitude;

  app.map.flyTo([lat, lng], 10);
});
