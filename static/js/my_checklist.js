"use strict";

const app = {};

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
      axios.get(get_checklist_url)
        .then(response => {
          this.checklists = response.data.checklists;
        })
        .catch((error) => {
          console.error("Error fetching checklists:", error);
        });
    },

    // Navigate to the checklist page for editing
    editChecklist(checklistId) {
      location.assign(edit_url + `?edit_id=${checklistId}`);
    },

    // Delete a checklist
    deleteChecklist(checklistId) {
        if (confirm("Are you sure you want to delete this checklist?")) {
          axios.delete(delete_url + `/${checklistId}`)
            .then(() => {
              this.fetchChecklists();  // Refresh the list of checklists after deletion
        })
        .catch(error => {
          console.error("Error deleting checklist:", error);
        });
      }
    }

  },
  mounted() {
    this.fetchChecklists();
  },
});

app.vue.mount("#my-checklist-app");
