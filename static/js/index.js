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
            apiInProgress: false,
        };
    },
    methods: {
        // Check if the user is logged in
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
        // Handle region selection from the map
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
                this.loadSpeciesList(); // Centralized call
                this.loadContributors();
            } else {
                console.error("Latitude or longitude is missing. Skipping API calls.");
            }
        },        
        selectSpecies: function (speciesName) {
            console.log("Species selected:", speciesName);
            this.selectedSpecies = speciesName;
            this.loadTrends(speciesName); // Fetch trends data for the selected species
        },
        loadSpeciesList: function () {
            if (!this.isLoggedIn) {
                alert("Please log in to view species data.");
                return;
            }

            const url = `${species_url}?latitude=${this.latitude}&longitude=${this.longitude}`;
            console.log("Making API request to:", url);

            if (this.apiInProgress) {
                console.warn("Species API call already in progress. Skipping...");
                return; // Prevent duplicate calls
            }

            this.apiInProgress = true;

            axios
                .get(url)
                .then((response) => {
                    console.log("Species list loaded:", response.data);
                    this.speciesList = response.data.data || [];
                })
                .catch((error) => {
                    console.error("Error loading species list:", error);
                })
                .finally(() => {
                    this.apiInProgress = false; // Reset API progress flag
                });
        },
        // Load contributors data for the selected region
        loadContributors: function () {
            if (!this.isLoggedIn) {
                alert("Please log in to view contributors.");
                return;
            }

            if (!this.latitude || !this.longitude) {
                console.error("Latitude or longitude is missing:", this.latitude, this.longitude);
                alert("Please select a valid region.");
                return;
            }

            const url = `${contributors_url}?latitude=${encodeURIComponent(this.latitude)}&longitude=${encodeURIComponent(this.longitude)}`;
            console.log("Making API request to:", url);

            if (this.apiInProgress) {
                console.warn("Contributors API call already in progress. Skipping...");
                return; // Prevent duplicate calls
            }

            this.apiInProgress = true;

            axios
                .get(url)
                .then((response) => {
                    console.log("Contributors data loaded:", response.data);
                    this.contributors = response.data.data || [];
                })
                .catch((error) => {
                    console.error("Error loading contributors data:", error);
                })
                .finally(() => {
                    this.apiInProgress = false; // Reset API progress flag
                });
        },
        // Load trends data for the selected species
        loadTrends: function (speciesName) {
            if (!this.isLoggedIn) {
                alert("Please log in to view trends data.");
                return;
            }

            if (!this.latitude || !this.longitude) {
                console.error("Latitude or longitude is missing:", this.latitude, this.longitude);
                alert("Please select a valid region.");
                return;
            }

            console.log("Loading trends for species:", speciesName);

            axios
                .get(trends_url, {
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
        this.checkLoginStatus(); // Check login status on page load
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
        props: ['regionId'], // Accept regionId as a prop from the parent
        data() {
            return {
                speciesList: [], // Internal data for the species list
            };
        },
        watch: {
            regionId: function (newVal, oldVal) {
                if (newVal && newVal !== oldVal) {
                    this.fetchData(); // Trigger only if the regionId changes
                }
            },
        },
        methods: {
            fetchData() {
                if (!this.regionId) return;
                console.log("Fetching species data for regionId:", this.regionId);
                axios.get(species_url, { params: { region_id: this.regionId } })
                    .then((response) => {
                        console.log("Species data received:", response.data);
                        this.speciesList = response.data.data || [];
                    })
                    .catch((error) => {
                        console.error("Error fetching species data:", error);
                    });
            },
        },
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
        props: ['regionId', 'speciesName'],
        data() {
            return {
                trendsData: [],
            };
        },
        watch: {
            speciesName: 'fetchData', // Fetch data when speciesName changes
        },
        methods: {
            fetchData() {
                if (!this.speciesName) return;
                console.log("Fetching trends for species:", this.speciesName);
                axios.get(trends_url, {
                    params: {
                        region_id: this.regionId,
                        species_name: this.speciesName,
                    },
                })
                    .then((response) => {
                        console.log("Trends data received:", response.data);
                        this.trendsData = response.data.data || [];
                        this.renderGraph();
                    })
                    .catch((error) => {
                        console.error("Error fetching trends data:", error);
                    });
            },
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
        template: `<canvas ref="canvas"></canvas>`,
    },
    // Top Contributors
    'top-contributors': {
        props: ['regionId'],
        data() {
            return {
                contributors: [],
            };
        },
        watch: {
            regionId: function (newVal, oldVal) {
                if (newVal && newVal !== oldVal) {
                    this.fetchData(); // Trigger only if the regionId changes
                }
            },
        },        
        methods: {
            fetchData() {
                if (!this.regionId) return;
                console.log("Fetching contributors for regionId:", this.regionId);
                axios.get(contributors_url, { params: { region_id: this.regionId } })
                    .then((response) => {
                        console.log("Contributors data received:", response.data);
                        this.contributors = response.data.data || [];
                    })
                    .catch((error) => {
                        console.error("Error fetching contributors data:", error);
                    });
            },
        },
        template: `
            <ul>
                <li v-for="contributor in contributors" :key="contributor.observer_id">
                    Observer {{ contributor.observer_id }} - {{ contributor.checklist_count }} checklists
                </li>
            </ul>
        `,
    },
};

// Mount the Vue application
console.log("App instance created");
app.vue = Vue.createApp(app.data);

// Register components
Object.entries(app.components).forEach(([name, component]) => {
    console.log(`Registering component: ${name}`);
    app.vue.component(name, component);
});

// Mount the app
console.log("Mounting the app...");
app.vue.mount("#app");
