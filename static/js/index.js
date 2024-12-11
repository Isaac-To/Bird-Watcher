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
            if (this.apiInProgress.species) return;
            if (!this.isLoggedIn) {
                alert("Please log in to view species data.");
                return;
            }

            console.log("Making API request for species list.");
            const url = `${species_url}?latitude=${this.latitude}&longitude=${this.longitude}`;
            this.apiInProgress.species = true;

            axios.get(url)
                .then((response) => {
                    console.log("Species list loaded:", response.data);
                    this.speciesList = response.data.data || [];
                })
                .catch((error) => {
                    console.error("Error loading species list:", error);
                })
                .finally(() => {
                    this.apiInProgress.species = false;
                });
        },
        loadContributors: function () {
            if (this.apiInProgress.contributors) return;
            if (!this.isLoggedIn) {
                alert("Please log in to view contributors.");
                return;
            }

            console.log("Making API request for contributors.");
            const url = `${contributors_url}?latitude=${encodeURIComponent(this.latitude)}&longitude=${encodeURIComponent(this.longitude)}`;
            this.apiInProgress.contributors = true;

            axios.get(url)
                .then((response) => {
                    console.log("Contributors data loaded:", response.data);
                    this.contributors = response.data.data || [];
                })
                .catch((error) => {
                    console.error("Error loading contributors data:", error);
                })
                .finally(() => {
                    this.apiInProgress.contributors = false;
                });
        },
        loadTrends: function (speciesName) {
            if (!this.isLoggedIn) {
                alert("Please log in to view trends data.");
                return;
            }

            console.log("Loading trends for species:", speciesName);
            axios.get(trends_url, {
                params: {
                    latitude: this.latitude,
                    longitude: this.longitude,
                    species_name: speciesName,
                },
            })
            .then((response) => {
                console.log("Trends data loaded:", response.data);
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
                    {{ species.common_name }} ({{ species.total_count }} sightings)
                </li>
            </ul>
        `,
    },    
    'graph-visualization': {
        props: ['trendsData', 'speciesName'],
        methods: {
            renderGraph() {
                const labels = this.trendsData.map((row) => row.date);
                const values = this.trendsData.map((row) => row.total_count);
                new Chart(this.$refs.canvas, {
                    type: "line",
                    data: {
                        labels: labels,
                        datasets: [
                            {
                                label: `Sightings for ${this.speciesName}`,
                                data: values,
                            },
                        ],
                    },
                });
            },
        },
        watch: {
            trendsData: 'renderGraph',
        },
        template: `<canvas ref="canvas"></canvas>`,
    },
    'top-contributors': {
        props: ['contributors'],
        template: `
            <ul>
                <li v-for="contributor in contributors" :key="contributor.observer_id">
                    Observer {{ contributor.observer_id }} - {{ contributor.checklist_count }} checklists
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
