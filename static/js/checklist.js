"use strict";

const app = {};

window.addEventListener("DOMContentLoaded", () => {
  // Vue.js Application
  app.vue = Vue.createApp({
    data() {
      return {
        speciesList: speciesList || [],
        birdCounts: {},
        searchQuery: "",
        lat: lat, // Latitude passed from the server
        lng: lng, // Longitude passed from the server
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
          axios.get(`${checklist_url}?edit_id=${this.editId}`)
            .then(response => {
              const checklist = response.data;
              this.lat = checklist.latitude;
              this.lng = checklist.longitude;

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

        const payload = {
          lat: this.lat,
          lng: this.lng,
          species: Object.entries(this.birdCounts)
            .filter(([_, count]) => count > 0)
            .map(([name, count]) => ({ name, count })),
        };

        axios
          .post(checklist_url, payload)
          .then(() => {
            alert("Checklist submitted successfully!");
            
            window.location.href = my_checklist_url;

          })
          .catch((error) => {
            console.error("Error submitting checklist:", error);
            alert("Failed to submit checklist.");
          });
      },
    },
  });

  app.vue.mount("#checklist-app");
});




