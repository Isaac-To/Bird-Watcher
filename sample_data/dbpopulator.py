import sqlite3
import csv

if __name__ == "__main__":
    checklist = csv.reader(open("/Users/nijtandel/Bird-Watcher/sample_data/checklists.csv"), delimiter=",")
    sightings = csv.reader(open("/Users/nijtandel/Bird-Watcher/sample_data/sightings.csv"), delimiter=",")
    species = csv.reader(open("/Users/nijtandel/Bird-Watcher/sample_data/species.csv"), delimiter=",")

    conn = sqlite3.connect("/Users/nijtandel/Bird-Watcher/databases/storage.db")
    cursor = conn.cursor()

    for event in list(checklist)[1:]:
        event = (
            event[0][1:],
            event[1],
            event[2],
            event[3] + " " + event[4],
            event[5][3:],
            event[6],
        )
        cursor.execute(
            """INSERT INTO checklist(event_id, latitude, longitude, date, observer_id, duration_minutes)
            VALUES (?, ?, ?, ?, ?, ?)""",
            event,
        )

    for sighting in list(sightings)[1:]:
        sighting = (
            sighting[0][1:],
            sighting[1],
            sighting[2],
        )
        cursor.execute(
            """INSERT INTO sighting(event_id, common_name, count)
            VALUES (?, ?, ?)""",
            sighting,
        )

    for bird in list(species)[1:]:
        # Check if the species already exists
        cursor.execute("SELECT name FROM species WHERE name = ?", bird)
        if cursor.fetchone() is None:
            cursor.execute(
                """INSERT INTO species(name)
                VALUES (?)""",
                bird,
            )

    conn.commit()
    conn.close()
