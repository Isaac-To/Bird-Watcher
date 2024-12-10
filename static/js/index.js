"use strict";

let app = {};

// Vue application data and methods
app.data = {
    data: function () {
        return {
            regionId: null, // Selected region ID
            selectedSpecies: null, // Selected species name
            speciesList: [], // List of species in the region
            trendsData: [], // Trends data for the selected species
            contributors: [], // Top contributors in the region
        };
    },
    methods: {
        // Select a region from the map
        selectRegion: function (regionId) {
            this.regionId = regionId;
            this.loadSpeciesList();
            this.loadContributors();
        },
        // Handle species selection
        selectSpecies: function (speciesName) {
            this.selectedSpecies = speciesName;
            this.loadTrends(speciesName); // Fetch trends data for the selected species
        },
        // Load species data for the selected region
        loadSpeciesList: function () {
            axios
                .get(species_url, { params: { region_id: this.regionId } })
                .then((response) => {
                    this.speciesList = response.data.data;
                });
        },
        // Load trends data for the selected species
        loadTrends: function (speciesName) {
            axios
                .get(trends_url, {
                    params: { region_id: this.regionId, species_name: speciesName },
                })
                .then((response) => {
                    this.trendsData = response.data.data;
                });
        },
        // Load top contributors for the region
        loadContributors: function () {
            axios
                .get(contributors_url, { params: { region_id: this.regionId } })
                .then((response) => {
                    this.contributors = response.data.data;
                });
        },
    },
};

// Inline Vue components
app.components = {
    // Map Selector (Mocked Integration)
    'map-selector': {
        template: `<div id="map"></div>`,
        mounted() {
            let map = L.map("map").setView([51.505, -0.09], 13);
            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
            map.on("click", (e) => {
                let mockRegionId = "region_" + Math.round(e.latlng.lat * 1000); // Mock ID
                this.$emit("region-selected", mockRegionId);
            });
        },
    },

    // Species List
    'species-list': {
        props: ['regionId'],
        data() {
            return {
                speciesList: [],
            };
        },
        watch: {
            regionId: 'fetchData',
        },
        methods: {
            fetchData() {
                axios
                    .get(species_url, { params: { region_id: this.regionId } })
                    .then((response) => {
                        this.speciesList = response.data.data;
                    });
            },
            selectSpecies(speciesName) {
                this.$emit('species-selected', speciesName);
            },
        },
        template: `
            <ul>
                <li v-for="species in speciesList" :key="species.common_name" @click="selectSpecies(species.common_name)">
                    {{ species.common_name }} ({{ species.total_count }} sightings)
                </li>
            </ul>
        `,
    },

    // Graph Visualization
    'graph-visualization': {
        props: ['regionId', 'speciesName'],
        data() {
            return {
                trendsData: [],
            };
        },
        watch: {
            speciesName: 'fetchData',
        },
        methods: {
            fetchData() {
                axios
                    .get(trends_url, {
                        params: { region_id: this.regionId, species_name: this.speciesName },
                    })
                    .then((response) => {
                        this.trendsData = response.data.data;
                        this.renderGraph();
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
            regionId: 'fetchData',
        },
        methods: {
            fetchData() {
                axios
                    .get(contributors_url, { params: { region_id: this.regionId } })
                    .then((response) => {
                        this.contributors = response.data.data;
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
app.vue = Vue.createApp(app.data);

// Register components
Object.entries(app.components).forEach(([name, component]) => {
    app.vue.component(name, component);
});

// Mount the app
app.vue.mount("#app");
