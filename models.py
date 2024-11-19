"""
This file defines the database models
"""

import datetime
from .common import db, Field, auth
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
    Field("observer_id", "reference auth_user"),
    Field("duration_minutes", "integer"),
)

db.define_table("species", Field("name", unique=True))

db.commit()
