let app = new Vue({
  el: "#app",
  data: {
    checklists: checklists,
  },
  methods: {
    deleteChecklist(checklistId) {
      axios.delete(delete_checklist_url, { data: { id: checklistId } }).then(response => {
        alert("Checklist deleted successfully!");
        this.checklists = this.checklists.filter(checklist => checklist.id !== checklistId);
      }).catch(error => {
        alert("Failed to delete checklist.");
      });
    }
  }
});
