"""
This file defines the database models
"""

import datetime
import csv
from .common import db, Field, auth, logger
from pydal.validators import *


def get_user_email():
    return auth.current_user.get("email") if auth.current_user else None


def get_time():
    return datetime.datetime.utcnow()


db.define_table(
    "sighting",
    Field("event_id"),
    Field("common_name"),
    Field("count", "integer"),
)

db.define_table(
    "checklist",
    Field("event_id"),
    Field("latitude", "double"),
    Field("longitude", "double"),
    Field("date", "datetime"),
    Field("observer_id"),
    Field("duration_minutes", "integer"),
)

db.define_table("species", Field("name", unique=True))

# Prime databases
if db(db.sighting).isempty():
    print("Priming sighting database...")
    sightings = csv.reader(open("sample_data/sightings.csv"), delimiter=",")

    db.sighting.bulk_insert(
        [
            dict(
                event_id=sighting[0][1:],
                common_name=sighting[1],
                count=1 if sighting[2] == "X" else sighting[2],
            )
            for sighting in list(sightings)[1:]
        ]
    )

if db(db.checklist).isempty():
    print("Priming checklist database...")
    checklist = csv.reader(open("sample_data/checklists.csv"), delimiter=",")

    db.checklist.bulk_insert(
        [
            dict(
                event_id=event[0][1:],
                latitude=float(event[1]),
                longitude=float(event[2]),
                date=datetime.datetime.fromisoformat(
                    event[3] + " " + (event[4] or "12:00:00")
                ),
                observer_id=event[5][3:],
                duration_minutes=None if event[6] == "" else int(float(event[6])),
            )
            for event in list(checklist)[1:]
        ]
    )

if db(db.species).isempty():
    print("Priming species database...")
    species = csv.reader(open("sample_data/species.csv"), delimiter=",")

    db.species.bulk_insert([dict(name=bird[0]) for bird in list(species)[1:]])

db.commit()