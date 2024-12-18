"use strict";

const app = {};

// Vue.js Application
app.vue = Vue.createApp({
  data() {
    return {
      speciesList: speciesList || [],
      birdCounts: {},
      searchQuery: "",
      lat: lat, // Latitude passed from the server
      lng: lng, // Longitude passed from the server
      duration:null, //duration bound to input field
      editId: new URLSearchParams(window.location.search).get('edit_id'),
    };
  },
  computed: {
    // Filter species list based on search query
    filteredSpecies() {
      return this.speciesList.filter((species) =>
        species.toLowerCase().includes(this.searchQuery.toLowerCase())
      );
    },
  },
  methods: {
    // Increment count of birds for a given species
    incrementCount(species) {
      if (!this.birdCounts[species]) this.birdCounts[species] = 0;
      this.birdCounts[species]++;
    },

    // Fetch checklist data for editing
    fetchChecklistData() {
      if (this.editId) {
        axios.get(`${get_checklists_url}?edit_id=${this.editId}`)
          .then(response => {
            const checklist = response.data.checklists[0];
            console.log(checklist);
            this.lat = checklist.latitude;
            this.lng = checklist.longitude;
            this.duration = checklist.duration || 60; //default 60 minutes

            // Pre-fill the bird counts with the current data
            checklist.species.forEach(species => {
              this.birdCounts[species.name] = species.count;
            });
          })
          .catch(error => {
            console.error("Error fetching checklist for editing:", error);
          });
      }
    },

    // Submit the checklist data
    submitChecklist() {
      if (!this.lat || !this.lng) {
        alert("Missing latitude or longitude.");
        return;
      }

      // If no duration is provided, set it to 60 minutes by default
      if (!this.duration) {
        this.duration = 60;
      }


      const payload = {
        lat: this.lat,
        lng: this.lng,
        duration: this.duration, //Make sure duration is included
        species: Object.entries(this.birdCounts)
          .filter(([_, count]) => count > 0)
          .map(([name, count]) => ({ name, count })),
        editId: this.editId
      };

      axios
        .post(submit_url, payload)
        .then(() => {
          //alert("Checklist submitted successfully!");
          location.assign(my_checklists_url);
        })
        .catch((error) => {
          console.error("Error submitting checklist:", error);
          alert("Failed to submit checklist.");
        });
    },
  },
  mounted() {
    this.fetchChecklistData();  // Fetch checklist data if editing
  }
});

app.vue.mount("#checklist-app");


