let app = {};

app.data = {
  data: function () {
    return {
      bounds: L.latLngBounds([0, 0], [0, 0]),
      selectedSpecies: null,
      speciesList: [],
      trendsData: [],
      contributors: [],
      apiInProgress: {
        species: false,
        contributors: false,
      },
      chart: null,
    };
  },
  methods: {
    selectRegion: function (bounds) {
      this.bounds = bounds;

      this.loadSpeciesList();
      this.loadContributors();
    },
    selectSpecies: function (speciesName) {
      console.log("Species selected:", speciesName);
      this.selectedSpecies = speciesName;
      this.loadTrends(speciesName);
    },
    loadSpeciesList: function () {
      console.log("Making API request for species list.");
      axios
        .get(`${species_url}?bounds=${this.bounds.toBBoxString()}`)
        .then((response) => {
          console.log("Species list response:", response.data);
          this.speciesList = response.data.data || [];
        })
        .catch((error) => {
          console.error("Error loading species list:", error);
        });
    },
    loadContributors: function () {
      console.log("Making API request for contributors.");
      axios
        .get(`${contributors_url}?bounds=${this.bounds.toBBoxString()}`)
        .then((response) => {
          console.log("Contributors response:", response.data);
          this.contributors = response.data.data || [];
        })
        .catch((error) => {
          console.error("Error loading contributors data:", error);
        });
    },
    loadTrends: function (speciesName) {
      console.log("Loading trends for species:", speciesName);
      axios
        .get(`${trends_url}`, {
          params: {
            bounds: this.bounds.toBBoxString(),
            species_name: speciesName,
          },
        })
        .then((response) => {
          console.log("Trends data response:", response.data);
          this.trendsData = response.data.data || [];
        })
        .catch((error) => {
          console.error("Error loading trends data:", error);
        });
    },
  },
  watch: {
    speciesList: function (newVal) {
      console.log("Updated speciesList in parent:", newVal);
    },
    contributors: function (newVal) {
      console.log("Updated contributors in parent:", newVal);
    },
  },
};

app.components = {
  "map-selector": {
    props: ["bounds"],
    data() {
      return {
        rect: null,
        map: null,
      };
    },
    watch: {
      bounds() {
        this.rect.setBounds(this.bounds);
        this.map.panTo(this.bounds.getCenter());
      },
    },
    template: `<div id="map"></div>`,
    mounted() {
      console.log("Map Selector Mounted");
      this.map = L.map("map").setView(this.bounds.getCenter(), 7);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(
        this.map
      );

      this.map.on("click", (e) => {
        console.log("Map clicked at:", e.latlng);
        const size = 20 / Math.pow(2, this.map.getZoom() - 18);
        const bounds = e.latlng.toBounds(size);
        this.$emit("region-selected", bounds);
      });
      
      this.rect = L.rectangle(this.bounds, {
        color: "#ff2000",
        weight: 1,
      }).addTo(this.map);

      addEventListener("load", () => {
        // Add heatmap and selection area
        axios(sightings_url).then((response) => {
          const heat = L.heatLayer([]).addTo(this.map);
          const sightings = response.data.sightings;
          heat.setLatLngs(sightings);

          // Find median to compute a nice heatmap max
          sightings.sort((a, b) => b[2] - a[2]);
          if (sightings.length > 0) {
            const median = sightings[Math.floor(sightings.length / 2)][2];
            heat.setOptions({ max: median });
          }
        });

        // Update Leaflet map size once css is loaded
        this.map.invalidateSize();
      });
    },
  },
  "species-list": {
    props: ["speciesList"],
    template: `
<ul>
    <li 
        v-for="species in speciesList" 
        :key="species.common_name" 
        @click="$emit('species-selected', species.common_name)"
    >
    {{ species.common_name }} ({{ species.total_count || 0 }} sightings)
</li>

</ul>
        `,
  },
  "graph-visualization": {
    props: ["trendsData", "speciesName"],
    data() {
      return {
        chart: null, // Hold the chart instance here
      };
    },
    methods: {
      renderGraph() {
        // Ensure trendsData exists and has data
        if (!this.trendsData || this.trendsData.length === 0) {
          console.warn("No trends data to display.");
          return;
        }

        try {
          const labels = this.trendsData.map((row) => row.date);
          const values = this.trendsData.map((row) => row.total_count);

          // Destroy any existing chart to avoid duplicates
          if (this.chart) {
            this.chart.destroy();
          }

          // Ensure the canvas element exists
          const canvas = this.$refs.canvas;
          if (!canvas) {
            console.error("Canvas element not found.");
            return;
          }

          const ctx = canvas.getContext("2d");
          this.chart = new Chart(ctx, {
            type: "line",
            data: {
              labels: labels,
              datasets: [
                {
                  label: `Sightings for ${this.speciesName}`,
                  data: values,
                  borderColor: "blue",
                  backgroundColor: "rgba(0, 0, 255, 0.1)",
                  fill: true,
                },
              ],
            },
            options: {
              animation: false,
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                x: {
                  title: {
                    display: true,
                    text: "Date",
                  },
                },
                y: {
                  title: {
                    display: true,
                    text: "Sightings",
                  },
                },
              },
            },
          });
        } catch (error) {
          console.error("Error rendering the graph:", error);
        }
      },
    },
    mounted() {
      // Render the graph initially if trendsData already exists
      if (this.trendsData && this.trendsData.length > 0) {
        this.renderGraph();
      }
    },
    watch: {
      trendsData: {
        handler: "renderGraph",
        immediate: true, // Call handler immediately upon initial load
      },
    },
    template: `<div>
            <canvas ref="canvas"></canvas>
        </div>`,
    unmounted() {
      // Destroy the chart when the component is unmounted
      if (this.chart) {
        this.chart.destroy();
      }
    },
  },
  "top-contributors": {
    props: ["contributors"],
    template: `
<ul>
    <li v-for="contributor in contributors" :key="contributor.observer_id">
        Observer {{ contributor.observer_id }} - {{ contributor.checklist_count || 0 }} checklists
    </li>
</ul>
        `,
  },
};

app.vue = Vue.createApp(app.data);
Object.entries(app.components).forEach(([name, component]) => {
  app.vue.component(name, component);
});
app.vue = app.vue.mount("#app");

// Select region from query string
const urlParams = new URLSearchParams(window.location.search);
const bbox = urlParams.get("bounds");
if (bbox) {
  try {
    const coords = bbox.split(",");
    app.vue.selectRegion(
      L.latLngBounds(
        L.latLng(coords[1], coords[0]),
        L.latLng(coords[3], coords[2])
      )
    );
  } catch (e) {
    console.error("Failed to load bounds from query string:", e);
  }
}
