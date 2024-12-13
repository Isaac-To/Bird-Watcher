


"use strict";

const app = {};

window.addEventListener("DOMContentLoaded", () => {
  // Vue.js Application
  app.vue = Vue.createApp({
    data() {
      return {
        checklists: [], // List of user checklists
      };
    },
    methods: {
      // Fetch the user's checklists
      fetchChecklists() {
        axios
          .get(checklist_data_url)
          .then((response) => {
            this.checklists = response.data || [];
          })
          .catch((error) => {
            console.error("Error fetching checklists:", error);
            if (error.response) {
              console.error("Server responded with status:", error.response.status);
              console.error("Response data:", error.response.data);
            }



          });
      },

      // Delete a checklist
  deleteChecklist(checklistId) {
    if (confirm("Are you sure you want to delete this checklist?")) {
      axios.delete(`/my_checklist/delete/${checklistId}`)
        .then(() => {
          this.fetchChecklists();  // Refresh the list of checklists after deletion
        })
        .catch(error => {
          console.error("Error deleting checklist:", error);
        });
    }
  }


      // Redirect to the checklist page
      redirectChecklist(latlng, checklistID) {
        const query =
          "?lat=" + latlng.lat.toFixed(5) + "&lng=" + latlng.lng.toFixed(5) + "&edit_id"+ checklistId;

        window.location.href = checklist_url + query;
      },

    },
    mounted() {
      this.fetchChecklists();
    },
  });

  app.vue.mount("#my-checklists-app");
});

