import sqlite3
import csv
import datetime

if __name__ == "__main__":
    checklist = csv.reader(open("/Users/amina/cse183/apps/Bird-Watcher/sample_data/checklists.csv"), delimiter=",")
    sightings = csv.reader(open("/Users/amina/cse183/apps/Bird-Watcher/sample_data/sightings.csv"), delimiter=",")
    species = csv.reader(open("/Users/amina/cse183/apps/Bird-Watcher/sample_data/species.csv"), delimiter=",")

    conn = sqlite3.connect("/Users/amina/cse183/apps/Bird-Watcher/databases/storage.db")
    cursor = conn.cursor()

    for event in list(checklist)[1:]:
        event = (
            event[0][1:],
            event[1],
            event[2],
            event[3] + " " + (event[4] or "12:00:00"),
            event[5][3:],
            None if event[6] == '' else event[6],
        )
        # print(event)
        cursor.execute(
            """INSERT INTO checklist(event_id, latitude, longitude, date, observer_id, duration_minutes)
            VALUES (?, ?, ?, ?, ?, ?)""",
            event,
        )

    for sighting in list(sightings)[1:]:
        sighting = (
            sighting[0][1:],
            sighting[1],
            1 if sighting[2] == 'X' else sighting[2],
        )
        cursor.execute(
            """INSERT INTO sighting(event_id, common_name, count)
            VALUES (?, ?, ?)""",
            sighting,
        )

    for bird in list(species)[1:]:
        cursor.execute(
            """INSERT INTO species(name)
            VALUES (?)""",
            bird,
        )

    conn.commit()