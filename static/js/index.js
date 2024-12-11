"use strict";

let app = {};

app.data = {
    data: function () {
        return {
            isLoggedIn: false,
            regionId: null,
            latitude: null,
            longitude: null,
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
        checkLoginStatus: function () {
            axios.get(check_login_url)
                .then((response) => {
                    this.isLoggedIn = response.data.logged_in;
                    console.log(this.isLoggedIn ? "User is logged in." : "User is not logged in.");
                })
                .catch((error) => {
                    console.error("Error checking login status:", error);
                });
        },
        selectRegion: function (regionData) {
            console.log("Region selected:", regionData.regionId);
            console.log("Parsed Latitude and Longitude from click:", {
                lat: regionData.lat,
                lng: regionData.lng,
            });

            this.regionId = regionData.regionId;
            this.latitude = regionData.lat;
            this.longitude = regionData.lng;

            if (this.latitude && this.longitude) {
                console.log("Triggering API calls with latitude and longitude.");
                this.loadSpeciesList();
                this.loadContributors();
            } else {
                console.error("Latitude or longitude is missing. Skipping API calls.");
            }
        },
        selectSpecies: function (speciesName) {
            console.log("Species selected:", speciesName);
            this.selectedSpecies = speciesName;
            this.loadTrends(speciesName);
        },
        loadSpeciesList: function () {
            if (!this.isLoggedIn) {
                alert("Please log in to view species data.");
                return;
            }
            console.log("Making API request for species list.");
            axios.get(`${species_url}?latitude=${this.latitude}&longitude=${this.longitude}`)
                .then((response) => {
                    console.log("Species list response:", response.data);
                    this.speciesList = response.data.data || [];
                })
                .catch((error) => {
                    console.error("Error loading species list:", error);
                });
        },
                
        
        loadContributors: function () {
            if (!this.isLoggedIn) {
                alert("Please log in to view contributors.");
                return;
            }
            console.log("Making API request for contributors.");
            axios.get(`${contributors_url}?latitude=${this.latitude}&longitude=${this.longitude}`)
                .then((response) => {
                    console.log("Contributors response:", response.data);
                    this.contributors = response.data.data || [];
                })
                .catch((error) => {
                    console.error("Error loading contributors data:", error);
                });
        },                     
        loadTrends: function (speciesName) {
            if (!this.isLoggedIn) {
                alert("Please log in to view trends data.");
                return;
            }
            console.log("Loading trends for species:", speciesName);
            axios.get(`${trends_url}`, {
                params: {
                    latitude: this.latitude,
                    longitude: this.longitude,
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
    mounted: function () {
        console.log("Checking login status...");
        this.checkLoginStatus();
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
    'map-selector': {
        template: `<div id="map"></div>`,
        mounted() {
            console.log("Map Selector Mounted");
            const map = L.map("map").setView([51.505, -0.09], 13);
            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
            map.on("click", (e) => {
                console.log("Map clicked at:", e.latlng);
                const regionId = `region_${Math.round(e.latlng.lat * 1000)}`;
                this.$emit("region-selected", { regionId, lat: e.latlng.lat, lng: e.latlng.lng });
            });
        },
    },
    'species-list': {
        props: ['speciesList'], 
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
    'graph-visualization': {
        props: ['trendsData', 'speciesName'],
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
    'top-contributors': {
        props: ['contributors'],
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
app.vue.mount("#app");
