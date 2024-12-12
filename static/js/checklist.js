let app = new Vue({
    el: "#app",
    data: {
      speciesList: speciesList,
      birdCounts: {},
      searchTerm: "",
      checklists: checklists,
    },
    computed: {
      filteredSpecies() {
        return this.speciesList.filter(species => species.toLowerCase().includes(this.searchTerm.toLowerCase()));
      }
    },
    methods: {
      incrementCount(species) {
        if (!this.birdCounts[species]) this.birdCounts[species] = 0;
        this.birdCounts[species]++;
      },
      submitChecklist() {
        const checklistData = {
          birdCounts: this.birdCounts,
          lat: 52.3794,  // Example: replace with actual lat
          lng: 4.9009   // Example: replace with actual lng
        };
        axios.post(checklist_url, checklistData).then(response => {
          alert("Checklist submitted successfully!");
          window.location.href = "/Bird-Watcher/my_checklists";
        }).catch(error => {
          alert("Failed to submit checklist.");
        });
      },
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
  


/*
new Vue({
    el: '#app',
    data: {
      search: '',
      species: [],
    },
    computed: {
      filteredSpecies() {
        return this.species.filter(s => s.name.toLowerCase().includes(this.search.toLowerCase()));
      }
    },
    methods: {
      increment(species) {
        if (!species.count) species.count = 0;
        species.count++;
      },
      submitChecklist() {
        const checklist = {
          sightings: this.species.filter(s => s.count > 0),
          date: new Date().toISOString(),
          latitude: 0, // Replace with actual data
          longitude: 0, // Replace with actual data
          duration_minutes: 60, // Example duration
        };
  
        fetch('/submit_checklist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(checklist),
        }).then(response => response.json())
          .then(data => {
            if (data.status === 'success') {
              alert('Checklist submitted successfully!');
            } else {
              alert('Error submitting checklist.');
            }
          });
      }
    },
    mounted() {
      fetch('/species')
        .then(response => response.json())
        .then(data => {
          this.species = data.species;
        });
    }
  });
  
*/
